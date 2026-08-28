"""
Realistic Sensor Noise Model — simulates the stochastic behavior of real
physical sensors (thermometers, anemometers, barometers, power meters).

Real sensors differ from simple ``random.uniform()`` jitter in three ways:

1. **Autocorrelation**: A temperature reading at time T is strongly correlated
   with the reading at T-1. Real sensors don't jump randomly — they drift
   smoothly. Modeled via an Ornstein-Uhlenbeck process:
      x(t+dt) = x(t) + theta * (mean - x(t)) * dt + sigma * sqrt(dt) * N(0,1)
   where theta = mean-reversion rate, sigma = volatility, N(0,1) = Gaussian.

2. **Gaussian noise**: Real sensor electronics produce Gaussian (normal)
   distributed noise, not uniform. A thermistor has ±0.3°C Gaussian error,
   not ±0.3°C flat error.

3. **Sensor-specific characteristics**:
   - Temperature sensors have thermal mass (slow response, lag).
   - Wind anemometers have gust persistence (autocorrelated gusts).
   - Barometers drift slowly with synoptic weather systems.
   - Power meters have high-frequency noise from electrical switching.

Usage:
    from app.utils.sensor_noise import SensorChannel
    temp = SensorChannel(mean=-18.0, theta=0.05, sigma=0.4, noise_std=0.3)
    reading = temp.step(dt=10.0)  # advance 10 seconds, return new reading
"""
import math
import random
from typing import Dict


class SensorChannel:
    """
    A single simulated sensor channel using an Ornstein-Uhlenbeck process.

    Parameters:
        mean:     Long-term mean value the sensor reverts toward.
        theta:    Mean-reversion strength (1/s). Higher = reverts faster.
        sigma:    Process volatility (units/sqrt(s)). Drift magnitude.
        noise_std: Instantaneous Gaussian measurement noise (units).
        min_val:  Physical lower bound (clamped).
        max_val:  Physical upper bound (clamped).
        lag:      Sensor response lag in seconds (thermal mass). Higher = slower.
    """

    def __init__(
        self,
        mean: float,
        theta: float = 0.02,
        sigma: float = 0.3,
        noise_std: float = 0.2,
        min_val: float = -float("inf"),
        max_val: float = float("inf"),
        lag: float = 0.0,
    ) -> None:
        self.mean = mean
        self.theta = theta
        self.sigma = sigma
        self.noise_std = noise_std
        self.min_val = min_val
        self.max_val = max_val
        self.lag = lag
        self._value = mean
        self._target = mean

    @property
    def value(self) -> float:
        return self._value

    def set_mean(self, new_mean: float) -> None:
        """Shift the long-term mean (e.g. when weather model changes baseline)."""
        self.mean = new_mean

    def step(self, dt: float = 10.0) -> float:
        """
        Advance the sensor by dt seconds and return the new reading.

        The OU process provides autocorrelated, mean-reverting drift. A small
        Gaussian measurement noise is added on top to simulate electronics.
        If ``lag`` > 0, the sensor tracks a lagged target for realistic
        thermal-mass behavior.
        """
        # Ornstein-Uhlenbeck update: drift toward mean + Gaussian shock
        shock = random.gauss(0.0, 1.0)
        drift = self.theta * (self.mean - self._value) * dt
        diffusion = self.sigma * math.sqrt(dt) * shock
        self._value += drift + diffusion

        # Clamp to physical bounds
        self._value = max(self.min_val, min(self.max_val, self._value))

        # Add instantaneous measurement noise (Gaussian, not uniform)
        reading = self._value + random.gauss(0.0, self.noise_std)
        reading = max(self.min_val, min(self.max_val, reading))
        return round(reading, 2)

    def reset(self, value: float = None) -> None:
        """Reset the channel to a known state."""
        self._value = value if value is not None else self.mean


class SensorArray:
    """
    A collection of correlated sensor channels for a weather station.

    Models realistic cross-sensor correlations:
    - Pressure drop → wind increase (synoptic system approaching)
    - Temperature drop → humidity shift (cold air holds less moisture)
    - Wind increase → visibility decrease (blowing snow)
    """

    def __init__(self, station_code: str) -> None:
        self.station_code = station_code
        is_maitri = "MAITRI" in station_code.upper()
        base_temp = -8.0 if is_maitri else -5.0

        self.temperature = SensorChannel(
            mean=base_temp, theta=0.008, sigma=0.15, noise_std=0.3,
            min_val=-70.0, max_val=10.0, lag=60.0,
        )
        self.wind_speed = SensorChannel(
            mean=35.0 if is_maitri else 28.0, theta=0.015, sigma=3.0, noise_std=1.5,
            min_val=0.0, max_val=200.0, lag=5.0,
        )
        self.pressure = SensorChannel(
            mean=985.0 if is_maitri else 992.0, theta=0.003, sigma=0.5, noise_std=0.3,
            min_val=920.0, max_val=1050.0, lag=120.0,
        )
        self.humidity = SensorChannel(
            mean=65.0, theta=0.01, sigma=1.5, noise_std=1.0,
            min_val=20.0, max_val=100.0, lag=30.0,
        )
        self.wind_direction = SensorChannel(
            mean=165.0, theta=0.005, sigma=5.0, noise_std=3.0,
            min_val=0.0, max_val=360.0, lag=15.0,
        )

        self._initialized = False

    def step(self, dt: float = 10.0) -> Dict[str, float]:
        """
        Advance all sensors by dt seconds. Returns a dict of realistic
        sensor readings with cross-correlation effects applied.
        """
        # Step all channels
        temp = self.temperature.step(dt)
        wind = self.wind_speed.step(dt)
        pressure = self.pressure.step(dt)
        humidity = self.humidity.step(dt)
        wind_dir = self.wind_direction.step(dt)

        # Cross-sensor correlation: pressure drop -> wind surge
        # (synoptic low-pressure system drives katabatic acceleration)
        if pressure < self.pressure.mean - 5.0:
            wind_boost = (self.pressure.mean - pressure) * 0.3
            wind = min(200.0, wind + wind_boost)
            self.wind_speed._value = min(200.0, self.wind_speed._value + wind_boost * 0.1)

        # Temperature drop -> humidity decrease (cold air is drier)
        if temp < self.temperature.mean - 3.0:
            humidity = max(20.0, humidity - abs(temp - self.temperature.mean) * 0.5)

        # Visibility from wind (blowing snow)
        if wind > 60.0:
            visibility = max(0.3, 10.0 - (wind - 60.0) * 0.18)
        else:
            visibility = max(5.0, 20.0 - wind * 0.15)

        # Precipitation: stochastic, correlated with high humidity
        precipitation = 0.0
        if humidity > 80.0 and random.random() < 0.15:
            precipitation = round(random.gauss(0.5, 0.3), 2)
            precipitation = max(0.0, precipitation)

        self._initialized = True

        return {
            "temperature": round(temp, 1),
            "wind_speed": round(wind, 1),
            "wind_direction": round(wind_dir % 360, 1),
            "pressure": round(pressure, 1),
            "humidity": round(max(20.0, min(100.0, humidity)), 1),
            "precipitation": precipitation,
            "visibility": round(visibility, 1),
        }

    def adjust_mean(self, temperature: float = None, wind: float = None,
                    pressure: float = None, humidity: float = None) -> None:
        """Dynamically shift the long-term means (e.g. for seasonal drift or scenario override)."""
        if temperature is not None:
            self.temperature.set_mean(temperature)
        if wind is not None:
            self.wind_speed.set_mean(wind)
        if pressure is not None:
            self.pressure.set_mean(pressure)
        if humidity is not None:
            self.humidity.set_mean(humidity)


# Module-level registry: one SensorArray per station code
_sensor_arrays: Dict[str, SensorArray] = {}


def get_sensor_array(station_code: str) -> SensorArray:
    """Get or create the persistent SensorArray for a station."""
    code = station_code.upper()
    if code not in _sensor_arrays:
        _sensor_arrays[code] = SensorArray(code)
    return _sensor_arrays[code]
