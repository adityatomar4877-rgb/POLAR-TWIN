"""
ML Model Training Pipeline — Random Forest Energy Consumption Forecast.

Retrains the 6h / 12h / 24h RandomForestRegressor models used by
``EnergyForecastService`` directly from the telemetry stored in the database.

Design contract (must not be broken):
    * Reuses ``EnergyForecastService._build_features`` verbatim so the trained
      feature contract is identical to the live inference path.
    * Preserves the exact 63-feature names/order stored in ``feature_metadata.joblib``.
    * Adds model version, train/test record counts, and real evaluation metrics
      (MAE / RMSE / MAPE / R^2) to the metadata file.

Target definition (matches the API contract "average_consumption_kw"):
    For a sample at hour t, the target for horizon H is the mean of the next H
    hours of observed consumption:  mean(consumption[t+1 .. t+H]).

Usage (from backend/):
    python train_models.py                       # train for all stations with enough data
    python train_models.py --station BHARATI
    python train_models.py --test-size 0.2 --estimators 200
"""
import argparse
import json
import logging
import math
import warnings
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.core.database import SessionLocal, init_db
from app.models.station import Station
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.services.energy_forecast_service import EnergyForecastService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train")

ML_DIR = Path(__file__).resolve().parent / "app" / "ml"
HORIZONS = {"6h": 6, "12h": 12, "24h": 24}
MIN_HISTORY = 168          # longest lag feature (consumption_lag_168)
MODEL_VERSION = "2.0.0"


def _to_records(rows):
    """Convert ORM rows to lightweight duck-typed objects for _build_features."""
    out = []
    for r in rows:
        out.append(SimpleNamespace(
            timestamp=r.timestamp,
            consumption_kw=r.consumption_kw,
            generation_kw=r.generation_kw,
            solar_generation_kw=r.solar_generation_kw,
            diesel_generation_kw=r.diesel_generation_kw,
            battery_percentage=r.battery_percentage,
            battery_power_kw=r.battery_power_kw,
            fuel_percentage=r.fuel_percentage,
        ))
    return out


def _to_sensor_records(rows):
    out = []
    for r in rows:
        out.append(SimpleNamespace(
            timestamp=r.timestamp,
            temperature=r.temperature,
            humidity=r.humidity,
            pressure=r.pressure,
            wind_speed=r.wind_speed,
            wind_direction=r.wind_direction,
            precipitation=r.precipitation,
            visibility=r.visibility,
        ))
    return out


def _mape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mask = y_true > 1e-6
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def build_dataset(energy_recs, sensor_recs, feature_names):
    """
    Build (X, targets_dict) by sliding a 168-hour window through the history
    and reusing EnergyForecastService._build_features for each window.

    The inputs are first collapsed to one record per UTC hour so that any
    sub-hourly live-simulation records do not corrupt the hourly lag features.

    Returns:
        X: np.ndarray shape (n_samples, 63)
        targets: {horizon_key: np.ndarray shape (n_samples,)}
        sample_ts: list of timestamps marking each sample's "now"
    """
    # Collapse to hourly resolution (keeps the latest record per hour).
    energy_recs = EnergyForecastService._resample_to_hourly(energy_recs, max_buckets=0)
    sensor_recs = EnergyForecastService._resample_to_hourly(sensor_recs, max_buckets=0)

    svc = EnergyForecastService.__new__(EnergyForecastService)
    svc._feature_names = list(feature_names)
    svc._feature_count = len(feature_names)

    n = len(energy_recs)
    cons = [float(e.consumption_kw or 0.0) for e in energy_recs]

    max_horizon = max(HORIZONS.values())
    # valid sample index i: needs i-MIN_HISTORY+1 >= 0  AND  i+max_horizon < n
    start = MIN_HISTORY - 1
    end = n - max_horizon  # inclusive last valid i

    X_rows: List[List[float]] = []
    targets = {h: [] for h in HORIZONS}
    sample_ts = []

    for i in range(start, end + 1):
        e_win = energy_recs[i - MIN_HISTORY + 1: i + 1]
        s_win = sensor_recs[i - MIN_HISTORY + 1: i + 1]
        feats = svc._build_features(e_win, s_win)
        X_rows.append(feats)

        for hkey, hhours in HORIZONS.items():
            window = cons[i + 1: i + 1 + hhours]
            targets[hkey].append(float(sum(window) / len(window)) if window else 0.0)

        sample_ts.append(energy_recs[i].timestamp)

    X = np.array(X_rows, dtype=np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    targets = {h: np.array(v, dtype=float) for h, v in targets.items()}
    return X, targets, sample_ts


def train_for_station(db, station, test_size=0.2, n_estimators=200, min_samples_leaf=3):
    energy_rows = (
        db.query(EnergyTelemetry)
        .filter(EnergyTelemetry.station_id == station.id)
        .order_by(EnergyTelemetry.timestamp.asc())
        .all()
    )
    sensor_rows = (
        db.query(SensorTelemetry)
        .filter(SensorTelemetry.station_id == station.id)
        .order_by(SensorTelemetry.timestamp.asc())
        .all()
    )

    if len(energy_rows) < MIN_HISTORY + max(HORIZONS.values()) + 10:
        logger.warning(
            "Station %s has only %d energy records (need >= %d). Skipping.",
            station.code, len(energy_rows), MIN_HISTORY + max(HORIZONS.values()) + 10,
        )
        return None

    # Load existing feature names to preserve the 63-feature contract.
    meta_path = ML_DIR / "feature_metadata.joblib"
    if not meta_path.exists():
        raise RuntimeError(f"Feature metadata not found at {meta_path}. Cannot preserve feature contract.")
    old_meta = joblib.load(meta_path)
    feature_names = old_meta["features"]
    if len(feature_names) != old_meta["feature_count"]:
        raise RuntimeError("Existing feature_metadata.joblib is internally inconsistent.")

    logger.info(
        "Building feature/target dataset for %s from %d hourly records (features=%d)...",
        station.code, len(energy_rows), len(feature_names),
    )
    energy_recs = _to_records(energy_rows)
    sensor_recs = _to_sensor_records(sensor_rows)
    X, targets, sample_ts = build_dataset(energy_recs, sensor_recs, feature_names)
    n_samples = X.shape[0]
    logger.info("Built %d training samples with %d features.", n_samples, X.shape[1])

    split = int(n_samples * (1.0 - test_size))
    X_train, X_test = X[:split], X[split:]
    ts_train, ts_test = sample_ts[:split], sample_ts[split:]

    # Wrap in DataFrames so the fitted models carry feature names, matching
    # the live inference path (which also predicts on a named DataFrame).
    X_train_df = pd.DataFrame(X_train, columns=feature_names)
    X_test_df = pd.DataFrame(X_test, columns=feature_names)

    metrics = {}
    models = {}
    for hkey, hhours in HORIZONS.items():
        y = targets[hkey]
        y_train, y_test = y[:split], y[split:]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            rf = RandomForestRegressor(
                n_estimators=n_estimators,
                max_depth=None,
                min_samples_leaf=min_samples_leaf,
                max_features=0.8,
                random_state=42,
                n_jobs=-1,
            )
            rf.fit(X_train_df, y_train)

        y_pred = rf.predict(X_test_df)
        y_pred_clamped = np.maximum(0.0, y_pred)

        mae = float(mean_absolute_error(y_test, y_pred_clamped))
        rmse = float(math.sqrt(mean_squared_error(y_test, y_pred_clamped)))
        mape = _mape(y_test, y_pred_clamped)
        r2 = float(r2_score(y_test, y_pred_clamped))

        metrics[hkey] = {
            "mae_kw": round(mae, 4),
            "rmse_kw": round(rmse, 4),
            "mape_percent": round(mape, 4) if not math.isnan(mape) else None,
            "r2": round(r2, 4),
            "test_records": int(len(y_test)),
            "target_horizon_hours": hhours,
        }
        models[hkey] = rf

        logger.info(
            "[%s %s] MAE=%.3f kW  RMSE=%.3f kW  MAPE=%.2f%%  R2=%.4f  (n_test=%d)",
            station.code, hkey, mae, rmse, mape if not math.isnan(mape) else float("nan"),
            r2, len(y_test),
        )

        # Save model file (overwrite the existing read-only inference artifact).
        out_path = ML_DIR / f"energy_forecast_{hkey}_rf.joblib"
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            joblib.dump(rf, out_path)
        logger.info("Saved %s", out_path.name)

    meta = {
        "features": list(feature_names),
        "feature_count": len(feature_names),
        "targets": {
            hkey: f"mean_consumption_kw_next_{HORIZONS[hkey]}h" for hkey in HORIZONS
        },
        "model_type": "RandomForestRegressor",
        "model_name": "RandomForestEnergyForecast",
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "trained_on_station": station.code,
        "train_records": int(split),
        "test_records": int(n_samples - split),
        "n_estimators": n_estimators,
        "min_samples_leaf": min_samples_leaf,
        "history_records_used": len(energy_rows),
        "train_window": {
            "start": ts_train[0].isoformat() if ts_train else None,
            "end": ts_train[-1].isoformat() if ts_train else None,
        },
        "test_window": {
            "start": ts_test[0].isoformat() if ts_test else None,
            "end": ts_test[-1].isoformat() if ts_test else None,
        },
        "metrics": metrics,
    }
    meta_path = ML_DIR / "feature_metadata.joblib"
    joblib.dump(meta, meta_path)
    logger.info("Updated %s (version %s).", meta_path.name, MODEL_VERSION)

    return {
        "station": station.code,
        "samples": n_samples,
        "train_records": int(split),
        "test_records": int(n_samples - split),
        "metrics": metrics,
    }


def main():
    parser = argparse.ArgumentParser(description="Retrain Random Forest energy forecast models.")
    parser.add_argument("--station", default=None, help="Station code to train (default: all with enough data).")
    parser.add_argument("--test-size", type=float, default=0.2, help="Chronological test split fraction.")
    parser.add_argument("--estimators", type=int, default=200, help="Number of RF trees.")
    parser.add_argument("--min-samples-leaf", type=int, default=3, help="RF min_samples_leaf.")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        q = db.query(Station)
        if args.station:
            q = q.filter(Station.code == args.station.upper())
        stations = q.all()
        if not stations:
            logger.error("No stations found.")
            return

        results = []
        for st in stations:
            r = train_for_station(
                db, st,
                test_size=args.test_size,
                n_estimators=args.estimators,
                min_samples_leaf=args.min_samples_leaf,
            )
            if r:
                results.append(r)

        print("\n" + "=" * 60)
        print("TRAINING SUMMARY")
        print("=" * 60)
        print(json.dumps(results, indent=2, default=str))
    except Exception as e:
        logger.error("Training failed: %s", e, exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
