"""
ML Energy Forecast Service — Random Forest Inference Layer.

Loads pre-trained RandomForest .joblib models at initialization and exposes
a ``predict`` method that builds 63 engineered features from the existing
telemetry database and runs all three horizon models (6h, 12h, 24h).

Models are READ-ONLY; they are never overwritten or retrained from this service.
"""

import logging
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from sqlalchemy.orm import Session

from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.core.security import APIError

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────
#  Constants
# ────────────────────────────────────────────────────────
_ML_DIR = Path(__file__).resolve().parent.parent / "ml"
_MODEL_FILES = {
    "6h": _ML_DIR / "energy_forecast_6h_rf.joblib",
    "12h": _ML_DIR / "energy_forecast_12h_rf.joblib",
    "24h": _ML_DIR / "energy_forecast_24h_rf.joblib",
}
_METADATA_FILE = _ML_DIR / "feature_metadata.joblib"

# Minimum history depth (hours) required to build all lag/rolling features.
# The longest lag is consumption_lag_168 → 168 hourly records.
_MIN_HISTORY_HOURS = 168

# The live simulation worker writes telemetry every ~10s into the same table
# the ML reads as HOURLY history. To keep lag/rolling features semantically
# correct (lag_1 ≈ 1 hour ago, not 10 seconds ago), we fetch a generous window
# and collapse it to one record per UTC hour before feature engineering.
_HISTORY_FETCH_LIMIT = 8000

# Predictions are cached per-station for a short window so that the real-time
# dashboard (which refetches every ~10s via WebSocket) doesn't recompute 3 RF
# models on every request. The TTL is kept short (5s) so forecasts stay
# effectively real-time while avoiding redundant computations within the
# same request burst.
_PREDICTION_CACHE_TTL_SECONDS = 5

# No hardcoded scenario parameters — all scenario adjustments are computed
# dynamically from actual station conditions (historical telemetry, equipment
# state, load groups, logistics) via compute_scenario_dynamics().


class EnergyForecastService:
    """Singleton-style service: loads models once, runs inference many times."""

    @staticmethod
    def _resample_to_hourly(records, max_buckets: int = _MIN_HISTORY_HOURS):
        """
        Collapse a (possibly sub-hourly) telemetry series to one record per
        UTC hour, keeping the most recent record within each hour bucket, and
        return the last ``max_buckets`` hourly buckets in chronological order.
        """
        if not records:
            return []
        bucket = {}
        for r in records:
            ts = r.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            key = ts.replace(minute=0, second=0, microsecond=0)
            bucket[key] = r  # overwrite -> keeps the latest record in that hour
        ordered = [r for _, r in sorted(bucket.items(), key=lambda kv: kv[0])]
        return ordered[-max_buckets:] if max_buckets else ordered

    def __init__(self) -> None:
        self._models: Dict[str, Any] = {}
        self._feature_names: List[str] = []
        self._feature_count: int = 0
        self._targets: Dict[str, str] = {}
        self._model_type: str = ""
        self._model_version: str = "1.0.0"
        self._model_metrics: Dict[str, Any] = {}
        self._trained_on_station: Optional[str] = None
        self._metadata: Dict[str, Any] = {}
        self._loaded: bool = False
        # Per-station prediction cache: station_id -> (timestamp, result_dict)
        self._prediction_cache: Dict[int, Tuple[float, Dict[str, Any]]] = {}

    # ─── Lazy Initialization ───────────────────────────
    def _ensure_loaded(self) -> None:
        """Load models & metadata on first call (not import-time)."""
        if self._loaded:
            return
        try:
            import joblib
        except ImportError as exc:
            raise APIError(
                code="ML_DEPENDENCY_MISSING",
                message="Required package 'joblib' is not installed.",
                status_code=500,
            ) from exc

        # 1. Feature metadata
        if not _METADATA_FILE.exists():
            raise APIError(
                code="ML_METADATA_MISSING",
                message=f"Feature metadata file not found at {_METADATA_FILE}.",
                status_code=500,
            )
        meta = joblib.load(_METADATA_FILE)
        self._metadata = meta
        self._feature_names = meta["features"]
        self._feature_count = meta["feature_count"]
        self._targets = meta.get("targets", {})
        self._model_type = meta.get("model_type", "RandomForestRegressor")
        self._model_version = meta.get("model_version", "1.0.0")
        self._model_metrics = meta.get("metrics", {})
        self._trained_on_station = meta.get("trained_on_station")

        if len(self._feature_names) != self._feature_count:
            raise APIError(
                code="ML_METADATA_CORRUPT",
                message=(
                    f"Feature metadata declares {self._feature_count} features "
                    f"but lists {len(self._feature_names)}."
                ),
                status_code=500,
            )

        # 2. Model files
        import warnings
        for horizon, path in _MODEL_FILES.items():
            if not path.exists():
                raise APIError(
                    code="ML_MODEL_MISSING",
                    message=f"Model file for {horizon} horizon not found at {path}.",
                    status_code=500,
                )
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = joblib.load(path)
            # Sanity-check n_features
            if hasattr(model, "n_features_in_") and model.n_features_in_ != self._feature_count:
                raise APIError(
                    code="ML_MODEL_FEATURE_MISMATCH",
                    message=(
                        f"Model {horizon} expects {model.n_features_in_} features, "
                        f"but metadata specifies {self._feature_count}."
                    ),
                    status_code=500,
                )
            self._models[horizon] = model
            logger.info(
                "ML model loaded: horizon=%s  estimators=%s  features=%d  path=%s",
                horizon,
                getattr(model, "n_estimators", "?"),
                self._feature_count,
                path.name,
            )

        self._loaded = True
        logger.info(
            "EnergyForecastService fully initialized — %d models, %d features.",
            len(self._models),
            self._feature_count,
        )

    # ─── Scenario Adjustment (Physics-Based, Dynamic) ──
    @staticmethod
    def _get_scenario_adjustment(
        db: Session,
        station_id: int,
        station_code: str,
        scenario_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compute the consumption adjustment for the active what-if scenario
        DYNAMICALLY from actual current conditions — NOT from fixed constants.

        Physics models used:
          EXTREME_COLD: Δconsumption = thermal_load(target_temp) - thermal_load(current_temp)
          HIGH_ENERGY_DEMAND: Δconsumption = actual sheddable high-priority loads + science duty
          EQUIPMENT_DEGRADATION: Δconsumption = efficiency_loss × current_consumption
          CUSTOM: Δconsumption = load_modifier_kw from custom conditions
          Others (GENERATOR_FAILURE, FUEL_SHORTAGE, SUPPLY_DELAY): no consumption change

        Returns:
            {"scenario": str, "factor": float|None, "add_kw": float|None,
             "adjusted": bool, "current_temp_c": float, "detail": str}
        """
        import random as _rng
        from app.utils.calculations import calculate_building_thermal_load

        scenario = scenario_override
        custom_conditions = None

        if scenario is None:
            try:
                from app.services.simulation_service import simulation_service
                code = station_code.upper()
                scenario = simulation_service.active_scenarios.get(code, "NORMAL_OPERATION")
                custom_conditions = simulation_service.active_conditions.get(code)
            except Exception:
                scenario = "NORMAL_OPERATION"

        scenario = (scenario or "NORMAL_OPERATION").upper()

        # Fetch actual current conditions
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        latest_sensor = (
            db.query(SensorTelemetry)
            .filter(SensorTelemetry.station_id == station_id)
            .order_by(SensorTelemetry.timestamp.desc())
            .first()
        )

        current_temp = float(latest_sensor.temperature) if latest_sensor else -18.0
        current_wind = float(latest_sensor.wind_speed) if latest_sensor else 30.0
        current_consumption = float(latest_energy.consumption_kw) if latest_energy else 100.0

        factor = None
        add_kw = None
        detail = ""

        if scenario == "EXTREME_COLD":
            # Dynamic: use compute_scenario_dynamics for thermal load delta
            from app.simulation.telemetry_engine import compute_scenario_dynamics
            from app.models.station import Station
            station = db.query(Station).filter(Station.id == station_id).first()
            if station:
                current_diesel = float(latest_energy.diesel_generation_kw) if latest_energy else 80.0
                current_fuel = float(latest_energy.fuel_percentage) if latest_energy else 75.0
                sd = compute_scenario_dynamics(db, station, "EXTREME_COLD", current_temp, current_wind, current_consumption, current_diesel, current_fuel)
                add_kw = sd.get("extreme_cold_consumption_delta_kw", 0.0)
                # Add small stochastic variation (real cold snaps vary)
                add_kw = round(max(0.0, add_kw + _rng.gauss(0.0, 1.0)), 2)
                target_t = sd.get("extreme_cold_target_temp", -45.0)
                detail = f"thermal_delta({target_t}C vs {current_temp:.1f}C)={add_kw}kW"
            else:
                add_kw = 0.0

        elif scenario == "HIGH_ENERGY_DEMAND":
            # Dynamic: from actual sheddable loads via compute_scenario_dynamics
            from app.simulation.telemetry_engine import compute_scenario_dynamics
            from app.models.station import Station
            station = db.query(Station).filter(Station.id == station_id).first()
            if station:
                current_diesel = float(latest_energy.diesel_generation_kw) if latest_energy else 80.0
                current_fuel = float(latest_energy.fuel_percentage) if latest_energy else 75.0
                sd = compute_scenario_dynamics(db, station, "HIGH_ENERGY_DEMAND", current_temp, current_wind, current_consumption, current_diesel, current_fuel)
                add_kw = sd.get("high_demand_extra_load_kw", 0.0)
                detail = f"sheddable+science_duty={add_kw}kW"
            else:
                add_kw = 0.0

        elif scenario == "EQUIPMENT_DEGRADATION":
            # Dynamic: from actual equipment efficiency via compute_scenario_dynamics
            from app.simulation.telemetry_engine import compute_scenario_dynamics
            from app.models.station import Station
            station = db.query(Station).filter(Station.id == station_id).first()
            if station:
                current_diesel = float(latest_energy.diesel_generation_kw) if latest_energy else 80.0
                current_fuel = float(latest_energy.fuel_percentage) if latest_energy else 75.0
                sd = compute_scenario_dynamics(db, station, "EQUIPMENT_DEGRADATION", current_temp, current_wind, current_consumption, current_diesel, current_fuel)
                mult = sd.get("equipment_degradation_consumption_mult", 1.0)
                add_kw = round(current_consumption * (mult - 1.0), 2)
                degraded = sd.get("degraded_equipment_count", 0)
                detail = f"consumption={current_consumption:.1f} × (mult={mult}-1) degraded_count={degraded}"
            else:
                add_kw = 0.0

        elif scenario == "CUSTOM" and custom_conditions:
            load_mod = custom_conditions.get("load_modifier_kw")
            if load_mod is not None and float(load_mod) != 0.0:
                add_kw = float(load_mod)
                detail = f"custom load_modifier_kw={add_kw}"

        adjusted = (factor is not None and factor != 1.0) or (add_kw is not None and add_kw != 0.0)

        return {
            "scenario": scenario,
            "factor": factor,
            "add_kw": add_kw,
            "adjusted": adjusted,
            "current_temp_c": round(current_temp, 1),
            "current_consumption_kw": round(current_consumption, 1),
            "detail": detail,
        }

    @staticmethod
    def _apply_adjustment(base_pred: float, adj_info: Dict[str, Any]) -> float:
        """Apply a scenario adjustment to a single prediction value."""
        result = base_pred
        if adj_info["factor"] is not None:
            result = result * adj_info["factor"]
        if adj_info["add_kw"] is not None:
            result = result + adj_info["add_kw"]
        return max(0.0, round(result, 2))

    # ─── Public Interface ──────────────────────────────
    def predict(
        self,
        db: Session,
        station_id: int,
        station_code: str,
        use_cache: bool = True,
        scenario_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Build the 63-feature vector from the latest telemetry for *station_id*
        and run all three RF models.  Returns a dict ready for the API response.

        If a what-if scenario is active (or ``scenario_override`` is provided),
        the forecast is adjusted to reflect that scenario's consumption impact.

        Results are cached per-station for ``_PREDICTION_CACHE_TTL_SECONDS`` so
        that the real-time dashboard stays fast. Pass ``use_cache=False`` to
        force a fresh computation. ``scenario_override`` bypasses the cache.
        """
        self._ensure_loaded()

        # Scenario overrides always bypass the cache so what-if tests get
        # a fresh, scenario-adjusted prediction immediately.
        if use_cache and scenario_override is None:
            now_ts = datetime.now(timezone.utc).timestamp()
            cached = self._prediction_cache.get(station_id)
            if cached and (now_ts - cached[0]) < _PREDICTION_CACHE_TTL_SECONDS:
                result = dict(cached[1])
                result["cached"] = True
                result["cache_age_seconds"] = round(now_ts - cached[0], 1)
                return result

        # 1. Fetch history  ──────────────────────────────
        # Fetch a generous window then collapse to hourly so the live 10-second
        # simulation stream does not corrupt the hourly lag/rolling features.
        energy_history = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .limit(_HISTORY_FETCH_LIMIT)
            .all()
        )
        energy_history = self._resample_to_hourly(list(reversed(energy_history)))

        sensor_history = (
            db.query(SensorTelemetry)
            .filter(SensorTelemetry.station_id == station_id)
            .order_by(SensorTelemetry.timestamp.desc())
            .limit(_HISTORY_FETCH_LIMIT)
            .all()
        )
        sensor_history = self._resample_to_hourly(list(reversed(sensor_history)))

        if not energy_history or not sensor_history:
            raise APIError(
                code="INSUFFICIENT_TELEMETRY",
                message=(
                    f"Station '{station_code}' has no telemetry records. "
                    "At least 1 record is required; ≥168 records are recommended for accurate lag/rolling features."
                ),
                status_code=422,
            )

        # 2. Build feature vector  ───────────────────────
        features = self._build_features(energy_history, sensor_history)

        # 3. Validate feature vector  ────────────────────
        if len(features) != self._feature_count:
            raise APIError(
                code="ML_FEATURE_COUNT_MISMATCH",
                message=(
                    f"Generated {len(features)} features but model expects {self._feature_count}."
                ),
                status_code=500,
            )

        feature_array = np.array([features], dtype=np.float64)
        feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)

        # 4. Run inference  ──────────────────────────────
        import pandas as pd
        feature_df = pd.DataFrame(feature_array, columns=self._feature_names)

        forecast: Dict[str, Dict[str, float]] = {}
        horizon_hours_map = {"6h": 6, "12h": 12, "24h": 24}
        generated_at = datetime.now(timezone.utc)
        for horizon, model in self._models.items():
            try:
                pred = float(model.predict(feature_df)[0])
                # Clamp to non-negative (consumption can't be negative)
                pred = max(0.0, round(pred, 2))
            except Exception as exc:
                logger.error(
                    "Prediction failed for horizon=%s station=%s: %s",
                    horizon, station_code, exc,
                    exc_info=True,
                )
                raise APIError(
                    code="ML_PREDICTION_FAILURE",
                    message=f"Model prediction failed for {horizon} horizon: {exc}",
                    status_code=500,
                ) from exc

            forecast[horizon] = {"average_consumption_kw": pred}

            # Persist each forecast so live accuracy can be evaluated later.
            # Uses a SEPARATE session so its commit/rollback can never
            # interfere with the caller's transaction (e.g. equipment status
            # changes from the simulation tick).
            # Non-fatal: a DB write error must never break forecasting.
            try:
                from app.models.prediction import Prediction
                from app.core.database import SessionLocal as _PersistSession
                h_hours = horizon_hours_map.get(horizon, 6)
                persist_db = _PersistSession()
                try:
                    persist_db.add(Prediction(
                        station_id=station_id,
                        target_type="ENERGY_CONSUMPTION",
                        timestamp=generated_at,
                        horizon_hours=h_hours,
                        predicted_value=pred,
                        confidence=0.92,
                        model_name="RandomForestEnergyForecast",
                        metadata_json=f'{{"horizon":"{horizon}","version":"{self._model_version}"}}',
                    ))
                    persist_db.commit()
                finally:
                    persist_db.close()
            except Exception as perr:
                logger.debug("Could not persist prediction record: %s", perr)

        latest_consumption = float(energy_history[-1].consumption_kw) if energy_history[-1].consumption_kw is not None else 0.0

        # ── Apply what-if scenario adjustment to the forecast ──
        adj_info = self._get_scenario_adjustment(db, station_id, station_code, scenario_override)
        if adj_info["adjusted"]:
            adjusted_forecast: Dict[str, Dict[str, float]] = {}
            for horizon, fc in forecast.items():
                base = fc["average_consumption_kw"]
                adjusted_val = self._apply_adjustment(base, adj_info)
                adjusted_forecast[horizon] = {"average_consumption_kw": adjusted_val}
            forecast = adjusted_forecast

        result = {
            "station_id": station_id,
            "station_code": station_code,
            "generated_at": generated_at.isoformat(),
            "model_name": "RandomForestEnergyForecast",
            "model_version": self._model_version,
            "is_fallback": False,
            "current_consumption_kw": round(latest_consumption, 2),
            "forecast": forecast,
            "feature_count": self._feature_count,
            "history_records_used": len(energy_history),
            "model_metrics": self._model_metrics,
            "trained_on_station": self._trained_on_station,
            "cached": False,
            "cache_age_seconds": 0.0,
            "active_scenario": adj_info["scenario"],
            "scenario_adjusted": adj_info["adjusted"],
            "scenario_adjustment": {
                "factor": adj_info["factor"],
                "add_kw": adj_info["add_kw"],
                "current_temp_c": adj_info.get("current_temp_c"),
                "current_consumption_kw": adj_info.get("current_consumption_kw"),
                "calculation": adj_info.get("detail", ""),
            },
        }

        # Store in cache for subsequent fast dashboard refetches.
        # Only cache non-override predictions (override = what-if preview).
        if scenario_override is None:
            self._prediction_cache[station_id] = (
                datetime.now(timezone.utc).timestamp(), result
            )

        return result

    def clear_prediction_cache(self, station_id: Optional[int] = None) -> None:
        """Clear the prediction cache for a specific station or all stations."""
        if station_id is not None:
            self._prediction_cache.pop(station_id, None)
        else:
            self._prediction_cache.clear()

    # ─── Feature Engineering ───────────────────────────
    def _build_features(
        self,
        energy_history: List[EnergyTelemetry],
        sensor_history: List[SensorTelemetry],
    ) -> List[float]:
        """
        Build the exact 63-element feature vector that the training pipeline used.

        Feature groups:
          0-7    weather/sensor raw
          8-14   energy raw
          15-23  temporal encodings
          24-32  consumption lags
          33-37  generation lags
          38-47  consumption rolling mean/std
          48-50  generation rolling means
          51-57  rate-of-change features
          58-59  balance & ratio
          60-62  past averages (6h, 12h, 24h)
        """
        latest_energy = energy_history[-1]
        latest_sensor = sensor_history[-1]
        ts = latest_energy.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        # Helper: safe float
        def sf(val: Any, default: float = 0.0) -> float:
            try:
                v = float(val) if val is not None else default
                return v if math.isfinite(v) else default
            except (TypeError, ValueError):
                return default

        # ── 1. Consumption & generation arrays (chronological) ──
        cons_arr = [sf(e.consumption_kw) for e in energy_history]
        gen_arr = [sf(e.generation_kw) for e in energy_history]

        def lag(arr: List[float], n: int) -> float:
            """Get value *n* steps back from the end. Falls back to latest if history is too short."""
            idx = len(arr) - 1 - n
            return arr[idx] if idx >= 0 else arr[0]

        def rolling_mean(arr: List[float], window: int) -> float:
            slc = arr[-window:] if len(arr) >= window else arr
            return sum(slc) / len(slc) if slc else 0.0

        def rolling_std(arr: List[float], window: int) -> float:
            slc = arr[-window:] if len(arr) >= window else arr
            if len(slc) < 2:
                return 0.0
            m = sum(slc) / len(slc)
            variance = sum((x - m) ** 2 for x in slc) / len(slc)
            return math.sqrt(variance)

        # ── 2. Temporal features ──
        hour = ts.hour + ts.minute / 60.0
        dow = ts.weekday()
        doy = ts.timetuple().tm_yday

        # ── 3. Storm flag heuristic ──
        wind = sf(latest_sensor.wind_speed, 30.0)
        vis = sf(latest_sensor.visibility, 10.0)
        storm_flag = 1.0 if (wind > 70.0 or vis < 2.0) else 0.0

        # ── 4. Build ordered feature vector matching metadata ──
        feature_map: Dict[str, float] = {
            # --- Weather / sensor raw (0-7) ---
            "temperature_c": sf(latest_sensor.temperature, -18.0),
            "humidity_percent": sf(latest_sensor.humidity, 60.0),
            "pressure_hpa": sf(latest_sensor.pressure, 990.0),
            "wind_speed_ms": sf(latest_sensor.wind_speed, 30.0) / 3.6,  # km/h → m/s
            "wind_direction_deg": sf(latest_sensor.wind_direction, 170.0),
            "precipitation_mm": sf(latest_sensor.precipitation, 0.0),
            "visibility_km": vis,
            "storm_flag": storm_flag,

            # --- Energy raw (8-14) ---
            "consumption_kw": sf(latest_energy.consumption_kw),
            "solar_generation_kw": sf(latest_energy.solar_generation_kw),
            "diesel_generation_kw": sf(latest_energy.diesel_generation_kw),
            "battery_soc_percent": sf(latest_energy.battery_percentage, 85.0),
            "battery_power_kw": sf(latest_energy.battery_power_kw),
            "fuel_level_percent": sf(latest_energy.fuel_percentage, 75.0),
            "generation_kw": sf(latest_energy.generation_kw),

            # --- Temporal (15-23) ---
            "hour": hour,
            "day_of_week": float(dow),
            "day_of_year": float(doy),
            "hour_sin": math.sin(2.0 * math.pi * hour / 24.0),
            "hour_cos": math.cos(2.0 * math.pi * hour / 24.0),
            "dow_sin": math.sin(2.0 * math.pi * dow / 7.0),
            "dow_cos": math.cos(2.0 * math.pi * dow / 7.0),
            "day_sin": math.sin(2.0 * math.pi * doy / 365.0),
            "day_cos": math.cos(2.0 * math.pi * doy / 365.0),

            # --- Consumption lags (24-32) ---
            "consumption_lag_1": lag(cons_arr, 1),
            "consumption_lag_2": lag(cons_arr, 2),
            "consumption_lag_3": lag(cons_arr, 3),
            "consumption_lag_6": lag(cons_arr, 6),
            "consumption_lag_12": lag(cons_arr, 12),
            "consumption_lag_24": lag(cons_arr, 24),
            "consumption_lag_48": lag(cons_arr, 48),
            "consumption_lag_72": lag(cons_arr, 72),
            "consumption_lag_168": lag(cons_arr, 168),

            # --- Generation lags (33-37) ---
            "generation_lag_1": lag(gen_arr, 1),
            "generation_lag_3": lag(gen_arr, 3),
            "generation_lag_6": lag(gen_arr, 6),
            "generation_lag_12": lag(gen_arr, 12),
            "generation_lag_24": lag(gen_arr, 24),

            # --- Consumption rolling stats (38-47) ---
            "consumption_mean_3": rolling_mean(cons_arr, 3),
            "consumption_std_3": rolling_std(cons_arr, 3),
            "consumption_mean_6": rolling_mean(cons_arr, 6),
            "consumption_std_6": rolling_std(cons_arr, 6),
            "consumption_mean_12": rolling_mean(cons_arr, 12),
            "consumption_std_12": rolling_std(cons_arr, 12),
            "consumption_mean_24": rolling_mean(cons_arr, 24),
            "consumption_std_24": rolling_std(cons_arr, 24),
            "consumption_mean_48": rolling_mean(cons_arr, 48),
            "consumption_std_48": rolling_std(cons_arr, 48),

            # --- Generation rolling means (48-50) ---
            "generation_mean_6": rolling_mean(gen_arr, 6),
            "generation_mean_12": rolling_mean(gen_arr, 12),
            "generation_mean_24": rolling_mean(gen_arr, 24),

            # --- Rate-of-change features (51-57) ---
            "consumption_change_1h": cons_arr[-1] - lag(cons_arr, 1),
            "consumption_change_3h": cons_arr[-1] - lag(cons_arr, 3),
            "consumption_change_6h": cons_arr[-1] - lag(cons_arr, 6),
            "consumption_change_24h": cons_arr[-1] - lag(cons_arr, 24),
            "generation_change_1h": gen_arr[-1] - lag(gen_arr, 1),
            "generation_change_6h": gen_arr[-1] - lag(gen_arr, 6),
            "generation_change_24h": gen_arr[-1] - lag(gen_arr, 24),

            # --- Balance & ratio (58-59) ---
            "energy_balance_kw": sf(latest_energy.generation_kw) - sf(latest_energy.consumption_kw),
            "generation_to_load_ratio": (
                sf(latest_energy.generation_kw) / sf(latest_energy.consumption_kw, 1.0)
                if sf(latest_energy.consumption_kw, 1.0) > 0 else 1.0
            ),

            # --- Past averages (60-62) ---
            "past_avg_6h": rolling_mean(cons_arr, 6),
            "past_avg_12h": rolling_mean(cons_arr, 12),
            "past_avg_24h": rolling_mean(cons_arr, 24),
        }

        # Assemble in exact order from metadata
        ordered_features: List[float] = []
        for fname in self._feature_names:
            if fname not in feature_map:
                logger.warning("Missing feature '%s' — defaulting to 0.0", fname)
                ordered_features.append(0.0)
            else:
                ordered_features.append(feature_map[fname])

        return ordered_features

    # ─── Model Info & Live Accuracy ───────────────────
    def get_model_info(self) -> Dict[str, Any]:
        """Return metadata + offline metrics for the deployed models."""
        self._ensure_loaded()
        return {
            "model_name": "RandomForestEnergyForecast",
            "model_version": self._model_version,
            "model_type": self._model_type,
            "feature_count": self._feature_count,
            "trained_on_station": self._trained_on_station,
            "trained_at": self._metadata.get("trained_at"),
            "train_records": self._metadata.get("train_records"),
            "test_records": self._metadata.get("test_records"),
            "history_records_used": self._metadata.get("history_records_used"),
            "targets": self._targets,
            "metrics": self._model_metrics,
        }

    def compute_accuracy(self, db: Session, station_id: int, station_code: str) -> Dict[str, Any]:
        """
        Compare persisted past forecasts against the actual average consumption
        that materialised in each forecast's target window.

        A forecast made at time T for horizon H predicted the mean consumption
        over [T+1h, T+Hh]. Once that window has fully elapsed, we can score it.
        """
        self._ensure_loaded()
        from app.models.prediction import Prediction
        from datetime import datetime, timezone, timedelta

        now = datetime.now(timezone.utc)
        horizon_hours = {"6h": 6, "12h": 12, "24h": 24}

        preds = (
            db.query(Prediction)
            .filter(
                Prediction.station_id == station_id,
                Prediction.target_type == "ENERGY_CONSUMPTION",
            )
            .order_by(Prediction.timestamp.asc())
            .all()
        )

        if not preds:
            return {
                "station_id": station_id,
                "station_code": station_code,
                "evaluated_at": now.isoformat(),
                "horizons": [],
                "note": "No persisted predictions yet. Call /predictions/energy first, then wait for the target windows to elapse.",
            }

        # Index actual consumption by timestamp for fast window averaging.
        actuals = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.asc())
            .all()
        )
        ts_to_cons: Dict[datetime, float] = {}
        for e in actuals:
            t = e.timestamp
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            ts_to_cons[t] = float(e.consumption_kw or 0.0)
        sorted_ts = sorted(ts_to_cons.keys())

        import bisect

        per_horizon: Dict[str, List[Tuple[float, float]]] = {h: [] for h in horizon_hours}

        for p in preds:
            hkey = None
            for k, hh in horizon_hours.items():
                if p.horizon_hours == hh:
                    hkey = k
                    break
            if hkey is None:
                continue
            t = p.timestamp
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            window_end = t + timedelta(hours=p.horizon_hours)
            if window_end > now:
                continue  # target window not fully elapsed yet

            # Gather actual consumption within (t, t+H]
            lo = bisect.bisect_right(sorted_ts, t)
            hi = bisect.bisect_right(sorted_ts, window_end)
            window_ts = sorted_ts[lo:hi]
            if not window_ts:
                continue
            actual_mean = sum(ts_to_cons[ts] for ts in window_ts) / len(window_ts)
            per_horizon[hkey].append((float(p.predicted_value), actual_mean))

        horizons_out = []
        for hkey, hh in horizon_hours.items():
            pairs = per_horizon[hkey]
            if not pairs:
                horizons_out.append({
                    "horizon": hkey, "horizon_hours": hh,
                    "evaluated_predictions": 0,
                    "mae_kw": 0.0, "rmse_kw": 0.0, "mape_percent": None,
                    "mean_actual_kw": None, "mean_predicted_kw": None,
                })
                continue
            preds_arr = [p for p, _ in pairs]
            acts_arr = [a for _, a in pairs]
            n = len(pairs)
            mae = sum(abs(p - a) for p, a in pairs) / n
            rmse = math.sqrt(sum((p - a) ** 2 for p, a in pairs) / n)
            non_zero = [a for a in acts_arr if a > 1e-6]
            mape = (sum(abs(p - a) / a for p, a in pairs if a > 1e-6) / len(non_zero) * 100.0) if non_zero else None
            horizons_out.append({
                "horizon": hkey, "horizon_hours": hh,
                "evaluated_predictions": n,
                "mae_kw": round(mae, 4),
                "rmse_kw": round(rmse, 4),
                "mape_percent": round(mape, 4) if mape is not None else None,
                "mean_actual_kw": round(sum(acts_arr) / n, 2),
                "mean_predicted_kw": round(sum(preds_arr) / n, 2),
            })

        return {
            "station_id": station_id,
            "station_code": station_code,
            "evaluated_at": now.isoformat(),
            "horizons": horizons_out,
        }


# Module-level singleton (mirrors the pattern in prediction_service.py)
energy_forecast_service = EnergyForecastService()
