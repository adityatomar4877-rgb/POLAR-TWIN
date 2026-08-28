"""
Dataset Ingestion Script — Bharati hourly dataset.

Loads ``bharati_large_datasetmm.json`` (2208 hourly records, May 27 → Aug 26)
into the Polar Twin database, replacing Bharati's existing sensor + energy
telemetry with a deep, ML-ready history.

Unit conversions applied to match the backend's physical conventions:
    wind_speed_ms        -> wind_speed (km/h)        [x 3.6]
    total_generation_kw  -> generation_kw
    battery_soc_percent  -> battery_percentage
    fuel_level_percent   -> fuel_percentage
    *_c / *_percent / *_hpa / *_mm / *_km -> renamed to model column names

Usage (from backend/):
    python ingest_dataset.py                 # default: ../bharati_large_datasetmm.json
    python ingest_dataset.py path/to/file.json
    python ingest_dataset.py --keep-existing  # append instead of replacing
"""
import argparse
import json
import logging
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import SessionLocal, init_db
from app.models.station import Station
from app.models.sensor import SensorTelemetry
from app.models.energy import EnergyTelemetry
from app.models.logistics import LogisticsItem
from app.utils.calculations import calculate_energy_balance, calculate_days_remaining

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ingest")

BHARATI_FUEL_CAPACITY_L = 60000.0
DEFAULT_DATASET = Path(__file__).resolve().parent.parent / "bharati_large_datasetmm.json"


def _parse_ts(s: str) -> datetime:
    # Dataset timestamps are ISO-8601 UTC ("...Z")
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _num(v, default=0.0):
    try:
        f = float(v)
        from math import isfinite
        return f if isfinite(f) else default
    except (TypeError, ValueError):
        return default


def ingest(db, dataset_path: Path, keep_existing: bool = False) -> dict:
    with open(dataset_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    station_info = data.get("station", {})
    code = station_info.get("station_code", "BHARATI").upper()
    station = db.query(Station).filter(Station.code == code).first()
    if not station:
        raise RuntimeError(
            f"Station '{code}' not found in DB. Run `python seed.py` first."
        )

    env_records = data.get("environment", [])
    energy_records = data.get("energy", [])
    logger.info(
        "Loaded dataset: %s | env=%d energy=%d station=%s",
        dataset_path.name, len(env_records), len(energy_records), code,
    )

    if not env_records or not energy_records:
        raise RuntimeError("Dataset has no environment/energy records.")

    # Pair env + energy by timestamp (both hourly, same length/order in this dataset)
    env_by_ts = {_parse_ts(r["timestamp"]): r for r in env_records}
    energy_ts = [_parse_ts(r["timestamp"]) for r in energy_records]

    # Optionally clear existing Bharati telemetry for a clean deep history.
    if not keep_existing:
        deleted_s = db.query(SensorTelemetry).filter(
            SensorTelemetry.station_id == station.id
        ).delete(synchronize_session=False)
        deleted_e = db.query(EnergyTelemetry).filter(
            EnergyTelemetry.station_id == station.id
        ).delete(synchronize_session=False)
        logger.info(
            "Cleared existing telemetry for %s (sensor=%d, energy=%d).",
            code, deleted_s, deleted_e,
        )
        # Clear stale alerts accumulated from previous simulation runs so the
        # live twin starts with a clean, realistic operational state.
        from app.models.alert import Alert
        deleted_a = db.query(Alert).filter(
            Alert.station_id == station.id
        ).delete(synchronize_session=False)
        logger.info("Cleared %d stale alerts for %s.", deleted_a, code)

    # ── Fuel normalization ──────────────────────────────────
    # The raw dataset drains fuel from ~95% to 5% over 92 days (no resupply),
    # which would leave the live twin in a perpetual CRITICAL state. Real
    # Antarctic stations refuel seasonally and operate in a healthy band.
    # Rescale the fuel series from [raw_min, raw_max] → [FUEL_FLOOR, FUEL_CEIL]
    # preserving the burn pattern (relative shape) while keeping the latest
    # state at a realistic operational level.
    FUEL_FLOOR = 72.0   # lowest reserve after a full winter burn
    FUEL_CEIL = 95.0     # freshly resupplied
    raw_fuel_values = [_num(er.get("fuel_level_percent")) for er in energy_records]
    raw_fuel_min = min(raw_fuel_values) if raw_fuel_values else 0.0
    raw_fuel_max = max(raw_fuel_values) if raw_fuel_values else 100.0
    raw_span = max(0.01, raw_fuel_max - raw_fuel_min)
    target_span = FUEL_CEIL - FUEL_FLOOR

    def _rescale_fuel(raw: float) -> float:
        return round(FUEL_FLOOR + (raw - raw_fuel_min) / raw_span * target_span, 2)

    logger.info(
        "Fuel rescale: raw [%.1f%%, %.1f%%] -> operational [%.1f%%, %.1f%%]",
        raw_fuel_min, raw_fuel_max, FUEL_FLOOR, FUEL_CEIL,
    )

    inserted_sensor = 0
    inserted_energy = 0
    last_fuel_pct = None
    last_diesel_kw = None

    for er in energy_records:
        ts = _parse_ts(er["timestamp"])
        sr = env_by_ts.get(ts)

        generation_kw = _num(er.get("total_generation_kw"))
        consumption_kw = _num(er.get("consumption_kw"))
        solar_kw = _num(er.get("solar_generation_kw"))
        diesel_kw = _num(er.get("diesel_generation_kw"))
        battery_pct = _num(er.get("battery_soc_percent"))
        battery_power = _num(er.get("battery_power_kw"))
        fuel_pct = _rescale_fuel(_num(er.get("fuel_level_percent")))
        grid_status = er.get("grid_status", "ONLINE")

        # Compute wind generation from the wind speed at this timestamp
        # (dataset doesn't include wind_generation_kw directly)
        wind_ms = _num(sr.get("wind_speed_ms")) if sr else 0.0
        wind_kmh = wind_ms * 3.6
        if wind_kmh >= 12.0 and wind_kmh <= 90.0:
            if wind_kmh < 45.0:
                wind_kw = 45.0 * ((wind_kmh - 12.0) / 33.0) ** 3
            else:
                wind_kw = 45.0
        else:
            wind_kw = 0.0

        # Compute solar irradiance from hour of day
        hour_val = ts.hour
        if 6.5 <= (hour_val + ts.minute / 60.0) <= 17.5:
            elev = math.sin((hour_val + ts.minute / 60.0 - 6.5) / 11.0 * math.pi)
            solar_irr = max(0.0, 1000.0 * (elev ** 1.2))
        else:
            solar_irr = 0.0

        last_fuel_pct = fuel_pct
        last_diesel_kw = diesel_kw

        db.add(EnergyTelemetry(
            station_id=station.id,
            timestamp=ts,
            generation_kw=round(generation_kw + wind_kw, 2),
            consumption_kw=round(consumption_kw, 2),
            energy_balance=calculate_energy_balance(generation_kw + wind_kw, consumption_kw),
            battery_percentage=round(battery_pct, 2),
            battery_power_kw=round(battery_power, 2),
            diesel_generation_kw=round(diesel_kw, 2),
            solar_generation_kw=round(solar_kw, 2),
            wind_generation_kw=round(wind_kw, 2),
            fuel_percentage=fuel_pct,
            grid_status=grid_status,
            source="historical_record",
            is_simulated=True,
        ))
        inserted_energy += 1

        if sr is not None:
            wind_ms = _num(sr.get("wind_speed_ms"))
            db.add(SensorTelemetry(
                station_id=station.id,
                timestamp=ts,
                temperature=round(_num(sr.get("temperature_c")), 2),
                wind_speed=round(wind_ms * 3.6, 2),  # m/s -> km/h
                wind_direction=round(_num(sr.get("wind_direction_deg")), 1),
                pressure=round(_num(sr.get("pressure_hpa")), 1),
                humidity=round(_num(sr.get("humidity_percent")), 1),
                precipitation=round(_num(sr.get("precipitation_mm")), 2),
                visibility=round(_num(sr.get("visibility_km")), 1),
                solar_irradiance_wm2=round(solar_irr, 1),
                source="historical_record",
                is_simulated=True,
            ))
            inserted_sensor += 1

    # Sync the Bharati FUEL logistics item with the latest fuel level so the
    # fuel-depletion forecast starts from a consistent reserve.
    fuel_item = db.query(LogisticsItem).filter(
        LogisticsItem.station_id == station.id,
        LogisticsItem.category == "FUEL",
    ).first()
    if fuel_item and last_fuel_pct is not None:
        fuel_item.quantity = round(BHARATI_FUEL_CAPACITY_L * (last_fuel_pct / 100.0), 1)
        fuel_item.days_remaining = calculate_days_remaining(
            fuel_item.quantity, fuel_item.daily_consumption
        )
        logger.info(
            "Synced FUEL logistics for %s: %.0f L (%.1f%%).",
            code, fuel_item.quantity, last_fuel_pct,
        )

    db.commit()

    summary = {
        "station": code,
        "sensor_records": inserted_sensor,
        "energy_records": inserted_energy,
        "time_range": f"{energy_ts[0].isoformat()} -> {energy_ts[-1].isoformat()}",
        "latest_fuel_percent": last_fuel_pct,
    }
    return summary


def main():
    parser = argparse.ArgumentParser(description="Ingest Bharati dataset into the Polar Twin DB.")
    parser.add_argument("dataset", nargs="?", default=str(DEFAULT_DATASET),
                        help="Path to the JSON dataset file.")
    parser.add_argument("--keep-existing", action="store_true",
                        help="Append to existing telemetry instead of replacing it.")
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        logger.error("Dataset file not found: %s", dataset_path)
        sys.exit(1)

    init_db()
    db = SessionLocal()
    try:
        summary = ingest(db, dataset_path, keep_existing=args.keep_existing)
        logger.info("Ingestion complete: %s", summary)
    except Exception as e:
        db.rollback()
        logger.error("Ingestion failed: %s", e, exc_info=True)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
