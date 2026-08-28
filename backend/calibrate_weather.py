"""
Weather Fallback Calibration Script.

Fits the ``FallbackWeatherProvider`` base constants (per station) to the
climatology of the supplied dataset(s) so the offline weather fallback tracks
real station conditions instead of hand-picked constants.

The fallback model (see ``app/services/weather_service.py``) is:

    season_phase = (day_of_year - 15) / 365.25 * 2pi
    seasonal_temp_offset = -12 * (1 - cos(season_phase))      # 0 summer .. -24 winter
    diurnal_temp = 3.5 * cos((hour - 14) / 24 * 2pi)
    temperature = C_temp + seasonal_temp_offset - (elev*0.006) + diurnal + noise
    wind_speed  = max(5, wind_base + U(-5, 15))               # mean gust ~= +5
    pressure    = pressure_base + U(-4, 4)

We solve for the per-station constants (C_temp, wind_base, pressure_base) by
least-squares against the dataset, then persist them to
``app/ml/weather_calibration.json`` for the provider to load at runtime.

Usage (from backend/):
    python calibrate_weather.py                         # default large dataset
    python calibrate_weather.py path/to/file1.json ...
"""
import argparse
import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("calibrate")

ML_DIR = Path(__file__).resolve().parent / "app" / "ml"
CALIB_FILE = ML_DIR / "weather_calibration.json"
DEFAULT_DATASET = Path(__file__).resolve().parent.parent / "bharati_large_datasetmm.json"


def _seasonal_offset(day_of_year: int) -> float:
    phase = (day_of_year - 15) / 365.25 * 2.0 * math.pi
    return -12.0 * (1.0 - math.cos(phase))


def _diurnal(hour: float) -> float:
    return 3.5 * math.cos((hour - 14.0) / 24.0 * 2.0 * math.pi)


def calibrate_file(path: Path) -> Dict[str, Dict[str, float]]:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    station = data.get("station", {})
    code = station.get("station_code", "UNKNOWN").upper()
    elev = float(station.get("elevation_m", 0.0) or 0.0)
    env = data.get("environment", [])
    if not env:
        logger.warning("No environment records in %s — skipping.", path.name)
        return {}

    temp_residuals: List[float] = []
    wind_kmh: List[float] = []
    pressures: List[float] = []

    for r in env:
        ts = datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00"))
        seasonal = _seasonal_offset(ts.timetuple().tm_yday)
        diurnal = _diurnal(ts.hour + ts.minute / 60.0)
        temp_c = float(r.get("temperature_c", 0.0))
        # residual = C_temp - elev*0.006  (seasonal + diurnal already removed)
        residual = temp_c - seasonal - diurnal
        temp_residuals.append(residual)
        wind_ms = float(r.get("wind_speed_ms", 0.0))
        wind_kmh.append(wind_ms * 3.6)
        pressures.append(float(r.get("pressure_hpa", 0.0)))

    n = len(temp_residuals)
    c_temp_minus_elev = sum(temp_residuals) / n
    c_temp = c_temp_minus_elev + (elev * 0.006)
    wind_base = (sum(wind_kmh) / n) - 5.0  # mean gust offset is +5
    pressure_base = sum(pressures) / n

    calibrated = {
        "base_temp_constant": round(c_temp, 3),
        "wind_base": round(max(5.0, wind_base), 2),
        "pressure_base": round(pressure_base, 1),
        "elevation_m": round(elev, 1),
        "calibration_records": n,
    }
    logger.info(
        "Calibrated %s: C_temp=%s  wind_base=%s  pressure_base=%s  (n=%d)",
        code, calibrated["base_temp_constant"], calibrated["wind_base"],
        calibrated["pressure_base"], n,
    )
    return {code: calibrated}


def main():
    parser = argparse.ArgumentParser(description="Calibrate weather fallback constants to a dataset.")
    parser.add_argument("datasets", nargs="*", help="Dataset JSON file(s).")
    args = parser.parse_args()

    files = [Path(p) for p in (args.datasets or [DEFAULT_DATASET])]
    merged: Dict[str, Dict[str, float]] = {}
    for f in files:
        if not f.exists():
            logger.warning("File not found: %s", f)
            continue
        merged.update(calibrate_file(f))

    if not merged:
        logger.error("No stations calibrated. Exiting.")
        return

    ML_DIR.mkdir(parents=True, exist_ok=True)
    existing = {}
    if CALIB_FILE.exists():
        try:
            existing = json.loads(CALIB_FILE.read_text(encoding="utf-8"))
        except Exception:
            existing = {}
    existing.update(merged)
    CALIB_FILE.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    logger.info("Saved calibration -> %s", CALIB_FILE)


if __name__ == "__main__":
    main()
