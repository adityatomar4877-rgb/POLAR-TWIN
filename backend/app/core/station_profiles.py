"""
Station Profile Configuration — Centralized Per-Station Engineering Constants.

Every station-specific value (fuel capacity, battery kWh, solar peak, thermal
envelope, etc.) lives here.  All services import ``get_station_profile()``
instead of scattering ``if "MAITRI" in code else …`` branches.

Adding a third station is a single dict entry — zero code changes elsewhere.
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class StationProfile:
    """Immutable engineering specification for an Antarctic research station."""

    # ── Non-default / Required Engineering Fields ──
    fuel_tank_capacity_liters: float
    battery_capacity_kwh: float
    solar_peak_capacity_kw: float
    base_electrical_load_kw: float
    thermal_envelope_u: float       # Fourier conduction coefficient (kW/K)
    ventilation_coeff: float        # Ventilation/infiltration coefficient (kW/K)
    weather_base_temp: float
    weather_wind_base: float
    weather_pressure_base: float
    nominal_generation_kw: float
    nominal_consumption_kw: float

    # ── Fields with Defaults ──
    generator_rated_kw: float = 120.0
    fallback_daily_burn_liters: float = 1150.0
    reset_health_score: float = 95.0
    reset_efficiency: float = 94.0
    reset_battery_pct: float = 85.0
    reset_fuel_pct: float = 82.0       # percentage (82.0%)
    reset_temperature: Dict[str, float] = field(default_factory=lambda: {
        "GENERATOR": 72.0,
        "HVAC": 42.0,
        "DEFAULT": 22.0,
    })

    # ── Post-Maintenance Baselines ──
    maintenance_health_score: float = 92.0
    maintenance_efficiency: float = 94.0

    # ── Sensor Telemetry Reset Baselines ──
    reset_sensor_temperature: float = -18.0
    reset_sensor_wind_speed: float = 32.0
    reset_sensor_wind_direction: float = 165.0
    reset_sensor_pressure: float = 990.0
    reset_sensor_humidity: float = 62.0

    def get_reset_temperature(self, equipment_type: str) -> float:
        """Return the nominal operating temperature for equipment reset."""
        return self.reset_temperature.get(equipment_type, self.reset_temperature["DEFAULT"])


# ── Registered Station Profiles ──────────────────────────────────────────────

_PROFILES: Dict[str, StationProfile] = {
    "MAITRI": StationProfile(
        fuel_tank_capacity_liters=75_000.0,
        battery_capacity_kwh=350.0,
        solar_peak_capacity_kw=40.0,
        base_electrical_load_kw=62.0,
        thermal_envelope_u=0.58,
        ventilation_coeff=0.38,
        weather_base_temp=-8.0,
        weather_wind_base=35.0,
        weather_pressure_base=985.0,
        nominal_generation_kw=150.0,
        nominal_consumption_kw=110.0,
        reset_sensor_temperature=-18.0,
    ),
    "BHARATI": StationProfile(
        fuel_tank_capacity_liters=60_000.0,
        battery_capacity_kwh=300.0,
        solar_peak_capacity_kw=60.0,
        base_electrical_load_kw=54.0,
        thermal_envelope_u=0.48,
        ventilation_coeff=0.32,
        weather_base_temp=-5.0,
        weather_wind_base=28.0,
        weather_pressure_base=992.0,
        nominal_generation_kw=135.0,
        nominal_consumption_kw=95.0,
        reset_sensor_temperature=-14.0,
    ),
}

# Default profile for unknown stations — uses conservative Bharati values
_DEFAULT_PROFILE = _PROFILES["BHARATI"]


def get_station_profile(station_code: str) -> StationProfile:
    """
    Look up the engineering profile for a station by its code.

    Matches partial codes (e.g. ``"MAITRI"`` in ``"MAITRI_01"``).
    Falls back to the default (Bharati) profile for unknown stations.
    """
    code_upper = station_code.upper()
    for key, profile in _PROFILES.items():
        if key in code_upper:
            return profile
    return _DEFAULT_PROFILE
