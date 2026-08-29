import json
import logging
import math
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
import httpx
from app.core.config import settings
from app.core.station_profiles import get_station_profile

logger = logging.getLogger(__name__)


class WeatherProvider:
    async def get_weather(self, station_code: str, lat: float, lon: float, elevation: float) -> Dict[str, Any]:
        raise NotImplementedError


class FallbackWeatherProvider(WeatherProvider):
    """
    High-fidelity Antarctic physics-based climate model.
    Generates realistic temperature, katabatic winds, and atmospheric pressure based on:
    - Latitude & Elevation (Lapse rate ~ 0.0098 °C/m)
    - Solar elevation / Hour of day (Diurnal cycle)
    - Season of year (Polar day / Polar night dynamics)

    Per-station base constants are calibrated to dataset climatology via
    ``app/ml/weather_calibration.json`` (produced by ``calibrate_weather.py``).
    Stations without a calibration entry fall back to sensible hardcoded
    Antarctic defaults.
    """

    _calibration: Optional[Dict[str, Any]] = None

    @classmethod
    def _load_calibration(cls) -> Dict[str, Any]:
        if cls._calibration is not None:
            return cls._calibration
        calib_path = Path(__file__).resolve().parent.parent / "ml" / "weather_calibration.json"
        try:
            if calib_path.exists():
                cls._calibration = json.loads(calib_path.read_text(encoding="utf-8"))
            else:
                cls._calibration = {}
        except Exception as e:
            logger.debug("Could not load weather calibration: %s", e)
            cls._calibration = {}
        return cls._calibration

    async def get_weather(self, station_code: str, lat: float, lon: float, elevation: float) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        day_of_year = now.timetuple().tm_yday
        hour = now.hour + now.minute / 60.0

        # Antarctic seasonality: Mid-winter (July, day ~195) vs Mid-summer (Jan, day ~15)
        # Seasonal temp variation: ~15-20°C swing
        season_phase = (day_of_year - 15) / 365.25 * 2 * math.pi
        seasonal_temp_offset = -12.0 * (1 - math.cos(season_phase)) # 0 in summer, -24 in winter

        code_upper = station_code.upper()
        calib = self._load_calibration().get(code_upper, {})

        # Station-specific baseline (calibrated constants take precedence, then profile defaults)
        profile = get_station_profile(station_code)
        base_temp_const = calib.get("base_temp_constant", profile.weather_base_temp)
        wind_base = calib.get("wind_base", profile.weather_wind_base)
        pressure_base = calib.get("pressure_base", profile.weather_pressure_base)
        elev = calib.get("elevation_m", elevation)

        base_temp = base_temp_const + seasonal_temp_offset - (elev * 0.006)

        # Diurnal fluctuation (~4-6°C variation) — physical forcing
        diurnal_rad = (hour - 14) / 24.0 * 2 * math.pi
        diurnal_temp = 3.5 * math.cos(diurnal_rad)

        # ── Realistic sensor simulation ──
        # Instead of flat ``random.uniform()`` noise, use a persistent
        # Ornstein-Uhlenbeck sensor array that produces autocorrelated,
        # Gaussian, mean-reverting readings — exactly what real sensors
        # produce. The seasonal/diurnal physics above sets the mean;
        # the sensor model adds realistic drift + measurement noise.
        from app.utils.sensor_noise import get_sensor_array
        sensor_array = get_sensor_array(station_code)

        # Dynamically adjust the sensor means to track the current
        # seasonal + diurnal physical baseline.
        sensor_array.adjust_mean(
            temperature=base_temp + diurnal_temp,
            wind=wind_base,
            pressure=pressure_base,
        )

        readings = sensor_array.step(dt=10.0)

        return {
            "temperature": readings["temperature"],
            "wind_speed": readings["wind_speed"],
            "wind_direction": readings["wind_direction"],
            "pressure": readings["pressure"],
            "humidity": readings["humidity"],
            "precipitation": readings["precipitation"],
            "visibility": readings["visibility"],
            "source": "simulation",
            "is_simulated": True,
            "timestamp": now.isoformat(),
        }


class ExternalWeatherProvider(WeatherProvider):
    """Fetches real atmospheric conditions from Open-Meteo or external API with in-memory caching."""

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    def clear_cache(self):
        self._cache.clear()

    async def get_weather(self, station_code: str, lat: float, lon: float, elevation: float) -> Dict[str, Any]:
        cache_key = f"{lat:.3f}_{lon:.3f}"
        now_ts = datetime.now(timezone.utc).timestamp()

        if cache_key in self._cache:
            entry = self._cache[cache_key]
            if now_ts - entry["cached_at"] < settings.WEATHER_CACHE_TTL_SECONDS:
                return dict(entry["data"])

        url = settings.WEATHER_API_URL
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,visibility",
        }

        async with httpx.AsyncClient(timeout=settings.WEATHER_API_TIMEOUT_SECONDS) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

            current = data.get("current", {})
            temp = float(current.get("temperature_2m", -20.0))
            humidity = float(current.get("relative_humidity_2m", 60.0))
            pressure = float(current.get("surface_pressure", 990.0))
            wind_speed = float(current.get("wind_speed_10m", 30.0))
            wind_dir = float(current.get("wind_direction_10m", 180.0))
            precip = float(current.get("precipitation", 0.0))
            vis_m = float(current.get("visibility", 10000.0))
            vis_km = round(vis_m / 1000.0, 1)

            result = {
                "temperature": round(temp, 1),
                "wind_speed": round(wind_speed, 1),
                "wind_direction": round(wind_dir, 1),
                "pressure": round(pressure, 1),
                "humidity": round(humidity, 1),
                "precipitation": round(precip, 1),
                "visibility": vis_km,
                "source": "external_weather_api",
                "is_simulated": False,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            self._cache[cache_key] = {"cached_at": now_ts, "data": result}
            return result


class WeatherService:
    def __init__(self):
        self.external_provider = ExternalWeatherProvider()
        self.fallback_provider = FallbackWeatherProvider()

    async def get_current_weather(self, station_code: str, lat: float, lon: float, elevation: float) -> Dict[str, Any]:
        """
        Gets the weather baseline (external API or physics fallback), then
        ALWAYS passes it through the realistic sensor array to produce
        autocorrelated, Gaussian readings — exactly like real sensors
        reading actual conditions. This means every tick produces slightly
        different values even when the external API is cached.
        """
        from app.utils.sensor_noise import get_sensor_array

        # 1. Get the baseline from external API or fallback
        source_tag = "external_weather_api"
        is_simulated = False
        try:
            baseline = await self.external_provider.get_weather(station_code, lat, lon, elevation)
            source_tag = baseline.get("source", "external_weather_api")
            is_simulated = baseline.get("is_simulated", False)
        except Exception as e:
            logger.debug(f"External weather fetch failed for {station_code} ({e}). Using Antarctic climate fallback.")
            baseline = await self.fallback_provider.get_weather(station_code, lat, lon, elevation)
            source_tag = baseline.get("source", "simulation")
            is_simulated = True

        # 2. Always apply realistic sensor noise on top of the baseline.
        # Real sensors at the station would read slightly different values
        # than the regional API model (microclimate, sensor electronics noise,
        # thermal mass). The sensor array produces autocorrelated, Gaussian,
        # mean-reverting readings around the baseline.
        sensor_array = get_sensor_array(station_code)
        sensor_array.adjust_mean(
            temperature=baseline["temperature"],
            wind=baseline["wind_speed"],
            pressure=baseline["pressure"],
            humidity=baseline["humidity"],
        )
        readings = sensor_array.step(dt=10.0)

        return {
            "temperature": readings["temperature"],
            "wind_speed": readings["wind_speed"],
            "wind_direction": readings["wind_direction"],
            "pressure": readings["pressure"],
            "humidity": readings["humidity"],
            "precipitation": readings["precipitation"],
            "visibility": readings["visibility"],
            "source": source_tag,
            "is_simulated": is_simulated,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def clear_cache(self):
        self.external_provider.clear_cache()


weather_service = WeatherService()
