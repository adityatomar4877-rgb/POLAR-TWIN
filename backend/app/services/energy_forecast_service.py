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
from typing import Any, Dict, List, Optional

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


class EnergyForecastService:
    """Singleton-style service: loads models once, runs inference many times."""

    def __init__(self) -> None:
        self._models: Dict[str, Any] = {}
        self._feature_names: List[str] = []
        self._feature_count: int = 0
        self._targets: Dict[str, str] = {}
        self._model_type: str = ""
        self._loaded: bool = False

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
        self._feature_names = meta["features"]
        self._feature_count = meta["feature_count"]
        self._targets = meta.get("targets", {})
        self._model_type = meta.get("model_type", "RandomForestRegressor")

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

    # ─── Public Interface ──────────────────────────────
    def predict(
        self,
        db: Session,
        station_id: int,
        station_code: str,
    ) -> Dict[str, Any]:
        """
        Build the 63-feature vector from the latest telemetry for *station_id*
        and run all three RF models.  Returns a dict ready for the API response.
        """
        self._ensure_loaded()

        # 1. Fetch history  ──────────────────────────────
        energy_history = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .limit(_MIN_HISTORY_HOURS)
            .all()
        )
        energy_history = list(reversed(energy_history))  # chronological

        sensor_history = (
            db.query(SensorTelemetry)
            .filter(SensorTelemetry.station_id == station_id)
            .order_by(SensorTelemetry.timestamp.desc())
            .limit(_MIN_HISTORY_HOURS)
            .all()
        )
        sensor_history = list(reversed(sensor_history))

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

        latest_consumption = float(energy_history[-1].consumption_kw) if energy_history[-1].consumption_kw is not None else 0.0

        return {
            "station_id": station_id,
            "station_code": station_code,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model_name": "RandomForestEnergyForecast",
            "is_fallback": False,
            "current_consumption_kw": round(latest_consumption, 2),
            "forecast": forecast,
            "feature_count": self._feature_count,
            "history_records_used": len(energy_history),
        }

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


# Module-level singleton (mirrors the pattern in prediction_service.py)
energy_forecast_service = EnergyForecastService()
