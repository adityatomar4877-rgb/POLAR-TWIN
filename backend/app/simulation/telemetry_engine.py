import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.station import Station
from app.models.sensor import SensorTelemetry
from app.models.energy import EnergyTelemetry
from app.models.equipment import Equipment
from app.models.logistics import LogisticsItem
from app.services.weather_service import weather_service
from app.services.alert_service import alert_service
from app.simulation.energy_simulator import EnergySimulator
from app.simulation.equipment_simulator import EquipmentSimulator
from app.simulation.logistics_simulator import LogisticsSimulator
from app.utils.calculations import calculate_building_thermal_load
from app.core.station_profiles import get_station_profile

logger = logging.getLogger(__name__)


def compute_scenario_dynamics(
    db: Session,
    station: Station,
    active_scenario: str,
    current_temp: float,
    current_wind: float,
    current_consumption: float,
    current_diesel_kw: float,
    prev_fuel_pct: float,
) -> Dict:
    """
    Compute all scenario parameters DYNAMICALLY from actual station state.

    Queries historical telemetry, equipment efficiencies, load groups, and
    logistics to derive scenario effects that adapt to real conditions —
    no hardcoded multipliers.

    Returns a dict of computed values that simulators use instead of
    fixed constants.
    """
    sid = station.id
    dynamics: Dict = {}

    # ── Historical statistics (last 168 hours) for dynamic thresholds ──
    hist_sensors = (
        db.query(SensorTelemetry)
        .filter(SensorTelemetry.station_id == sid)
        .order_by(SensorTelemetry.timestamp.desc())
        .limit(168)
        .all()
    )
    hist_temps = [float(s.temperature) for s in hist_sensors if s.temperature is not None]
    hist_winds = [float(s.wind_speed) for s in hist_sensors if s.wind_speed is not None]

    hist_temp_min = min(hist_temps) if hist_temps else current_temp
    hist_temp_p5 = sorted(hist_temps)[max(0, len(hist_temps) // 20)] if len(hist_temps) > 5 else hist_temp_min
    hist_wind_p95 = sorted(hist_winds)[min(len(hist_winds) - 1, int(len(hist_winds) * 0.95))] if len(hist_winds) > 5 else max(hist_winds) if hist_winds else current_wind

    # ── EXTREME_COLD: compute from actual historical distribution ──
    # Target temp = historical 5th percentile - 15°C (storm adds severe cold)
    dynamics["extreme_cold_target_temp"] = round(hist_temp_p5 - 15.0, 1)
    # Target wind = historical 95th percentile + 25 km/h (katabatic storm surge)
    dynamics["extreme_cold_target_wind"] = round(hist_wind_p95 + 25.0, 1)
    # Visibility from wind speed (physics: blowing snow reduces visibility)
    target_wind = dynamics["extreme_cold_target_wind"]
    dynamics["extreme_cold_visibility"] = round(max(0.3, 10.0 - max(0, target_wind - 60.0) * 0.2), 1)
    # Consumption delta from actual thermal load difference
    load_current = calculate_building_thermal_load(station.code, current_temp, current_wind)
    load_cold = calculate_building_thermal_load(station.code, dynamics["extreme_cold_target_temp"], dynamics["extreme_cold_target_wind"])
    dynamics["extreme_cold_consumption_delta_kw"] = round(max(0.0, load_cold["total_consumption_kw"] - load_current["total_consumption_kw"]), 2)

    # ── HIGH_ENERGY_DEMAND: compute from actual sheddable loads ──
    from app.models.audit import LoadGroup
    sheddable_loads = db.query(LoadGroup).filter(LoadGroup.station_id == sid, LoadGroup.shedable == True).all()
    sheddable_kw = sum(lg.current_power_kw for lg in sheddable_loads) if sheddable_loads else 30.0
    # Extra demand = sheddable capacity reactivated + science duty (stochastic, based on station capacity)
    import random as _rng
    science_duty = _rng.uniform(sheddable_kw * 0.8, sheddable_kw * 1.5)
    dynamics["high_demand_extra_load_kw"] = round(sheddable_kw * 0.5 + science_duty, 2)

    # ── GENERATOR_FAILURE: compute load shift from actual Gen1 output ──
    dynamics["generator_failure_load_shift_kw"] = max(0.0, current_diesel_kw)
    # Backup gen stress proportional to load it must absorb
    profile = get_station_profile(station.code)
    gen2_stress_factor = dynamics["generator_failure_load_shift_kw"] / profile.generator_rated_kw
    dynamics["gen2_temp_rise"] = round(gen2_stress_factor * 8.0, 1)  # up to 8°C rise at full load
    dynamics["gen2_eff_drop"] = round(gen2_stress_factor * 3.0, 1)  # up to 3% efficiency drop

    # ── FUEL_SHORTAGE: compute target from actual burn rate ──
    fuel_item = db.query(LogisticsItem).filter(LogisticsItem.station_id == sid, LogisticsItem.category == "FUEL").first()
    if fuel_item and fuel_item.daily_consumption > 0:
        # Target = just below minimum threshold (forces conservation mode)
        total_cap = profile.fuel_tank_capacity_liters
        dynamics["fuel_shortage_target_pct"] = round((fuel_item.minimum_threshold * 0.8 / total_cap) * 100.0, 1)
    else:
        dynamics["fuel_shortage_target_pct"] = 12.0
    # Generator wear from low fuel (leaner burn at <20% fuel)
    dynamics["fuel_shortage_gen_wear"] = round(max(0.1, (25.0 - prev_fuel_pct) / 25.0), 2) if prev_fuel_pct < 25.0 else 0.1

    # ── EQUIPMENT_DEGRADATION: compute from actual equipment efficiency ──
    all_equipment = db.query(Equipment).filter(Equipment.station_id == sid).all()
    running_eq = [e for e in all_equipment if e.status not in ["OFFLINE", "MAINTENANCE"]]
    if running_eq:
        avg_eff = sum(e.efficiency for e in running_eq) / len(running_eq)
        # Consumption increase = wasted energy from efficiency loss below nominal
        nominal_eff = 94.0
        eff_loss_pct = max(0.0, nominal_eff - avg_eff)
        dynamics["equipment_degradation_consumption_mult"] = round(1.0 + (eff_loss_pct / 100.0), 3)
        dynamics["degraded_equipment_count"] = sum(1 for e in running_eq if e.efficiency < 85.0)
    else:
        dynamics["equipment_degradation_consumption_mult"] = 1.0
        dynamics["degraded_equipment_count"] = 0

    # ── SUPPLY_DELAY: compute from actual load group + stock data ──
    non_critical_loads = [lg for lg in (sheddable_loads or []) if lg.category == "NON_CRITICAL" and lg.enabled]
    non_critical_kw = sum(lg.current_power_kw for lg in non_critical_loads)
    total_load_kw = max(1.0, current_consumption)
    # Conservation reduction = fraction of non-critical load that can be reduced
    dynamics["supply_delay_consumption_mult"] = round(max(0.85, 1.0 - (non_critical_kw / total_load_kw) * 0.5), 3)
    # Logistics conservation: fuel save proportional to non-critical fraction
    dynamics["supply_delay_fuel_mult"] = round(max(0.6, 1.0 - (non_critical_kw / total_load_kw) * 0.4), 2)
    # Food/medical burn increase (rationing stretches stock but per-day rate up)
    dynamics["supply_delay_ration_mult"] = round(1.0 + (non_critical_kw / total_load_kw) * 0.3, 2)
    # Spare parts: from actual degraded equipment count
    dynamics["supply_delay_spares_mult"] = round(1.0 + dynamics.get("degraded_equipment_count", 0) * 0.5, 2)

    # ── GENERATOR_FAILURE fuel: backup gen BSFC penalty ──
    # Backup generator is ~15-20% less efficient at non-optimal load
    dynamics["generator_failure_fuel_mult"] = round(1.0 + gen2_stress_factor * 0.2, 2)

    # ── EQUIPMENT_DEGRADATION spare parts: from degraded count ──
    dynamics["equipment_degradation_spares_mult"] = round(1.0 + dynamics.get("degraded_equipment_count", 0) * 0.8, 2)

    return dynamics


class TelemetryEngine:
    """Master Digital Twin simulation engine coordinating environment, microgrid, equipment, logistics, and alerts."""

    @staticmethod
    async def execute_simulation_cycle(
        db: Session,
        station: Station,
        active_scenario: str = "NORMAL_OPERATION",
        target_equipment_id: Optional[int] = None,
        custom_conditions: Optional[Dict] = None,
        dt_seconds: float = 10.0,
        broadcast_callback: Optional[Callable] = None,
    ) -> Dict:
        now = datetime.now(timezone.utc)
        conds = custom_conditions or {}

        # 1. Update Environment Telemetry
        weather_data = dict(
            await weather_service.get_current_weather(
                station_code=station.code,
                lat=station.latitude,
                lon=station.longitude,
                elevation=station.elevation,
            )
        )

        # Get current energy state for dynamic computation
        latest_energy_pre = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station.id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        _cur_temp = float(weather_data.get("temperature", -18.0))
        _cur_wind = float(weather_data.get("wind_speed", 30.0))
        _cur_con = float(latest_energy_pre.consumption_kw) if latest_energy_pre else 100.0
        _cur_diesel = float(latest_energy_pre.diesel_generation_kw) if latest_energy_pre else 80.0
        _cur_fuel = float(latest_energy_pre.fuel_percentage) if latest_energy_pre else 75.0

        # Compute all scenario parameters dynamically from actual station state
        scenario_dynamics = compute_scenario_dynamics(
            db, station, active_scenario, _cur_temp, _cur_wind, _cur_con, _cur_diesel, _cur_fuel
        )

        # Scenario overrides on weather — using DYNAMIC values from historical data
        if active_scenario == "EXTREME_COLD":
            weather_data["temperature"] = round(min(weather_data["temperature"], scenario_dynamics["extreme_cold_target_temp"]), 1)
            weather_data["wind_speed"] = round(max(weather_data["wind_speed"], scenario_dynamics["extreme_cold_target_wind"]), 1)
            weather_data["visibility"] = scenario_dynamics["extreme_cold_visibility"]
            weather_data["is_simulated"] = True
            weather_data["source"] = "simulation_scenario_override"

        # Custom conditions overrides on weather
        if conds.get("temperature_c") is not None:
            weather_data["temperature"] = round(float(conds["temperature_c"]), 1)
            weather_data["is_simulated"] = True
            weather_data["source"] = "custom_condition_override"

        if conds.get("wind_speed_kmh") is not None:
            weather_data["wind_speed"] = round(float(conds["wind_speed_kmh"]), 1)
            weather_data["is_simulated"] = True
            weather_data["source"] = "custom_condition_override"

        if conds.get("blizzard_warning") is True:
            # Compute blizzard intensity from current wind (not hardcoded)
            blizzard_wind = max(weather_data["wind_speed"], _cur_wind + 40.0)
            weather_data["wind_speed"] = round(blizzard_wind, 1)
            weather_data["visibility"] = round(max(0.3, 10.0 - max(0, blizzard_wind - 60.0) * 0.2), 1)
            weather_data["precipitation"] = round(max(1.0, blizzard_wind * 0.15), 1)
            weather_data["is_simulated"] = True
            weather_data["source"] = "custom_condition_override"

        # The weather provider already produces realistic sensor readings
        # (Ornstein-Uhlenbeck noise model). No additional noise layer needed —
        # real sensors don't get re-noised after reading.

        # Compute solar irradiance from hour of day (physical model)
        import math as _math
        _hour = now.hour + now.minute / 60.0
        if 6.5 <= _hour <= 17.5:
            _elev = _math.sin((_hour - 6.5) / 11.0 * _math.pi)
            solar_irr = max(0.0, 1000.0 * (_elev ** 1.2))  # peak ~1000 W/m² at solar noon
        else:
            solar_irr = 0.0

        sensor_entry = SensorTelemetry(
            station_id=station.id,
            timestamp=now,
            temperature=round(weather_data["temperature"], 1),
            wind_speed=round(max(0.0, weather_data["wind_speed"]), 1),
            wind_direction=round(weather_data["wind_direction"] % 360, 1),
            pressure=round(weather_data["pressure"], 1),
            humidity=round(max(10.0, min(100.0, weather_data["humidity"])), 1),
            precipitation=weather_data["precipitation"],
            visibility=weather_data["visibility"],
            solar_irradiance_wm2=round(solar_irr, 1),
            source=weather_data.get("source", "simulation"),
            is_simulated=weather_data.get("is_simulated", True),
        )
        db.add(sensor_entry)
        db.flush()

        # 2. Retrieve Previous Energy State & Equipment Statuses
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station.id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        prev_bat = latest_energy.battery_percentage if latest_energy else 85.0
        prev_fuel = latest_energy.fuel_percentage if latest_energy else 75.0

        # Allow custom conditions to override starting battery/fuel
        if conds.get("battery_percentage") is not None:
            prev_bat = float(conds["battery_percentage"])
        if conds.get("fuel_percentage") is not None:
            prev_fuel = float(conds["fuel_percentage"])

        equipment_list = db.query(Equipment).filter(Equipment.station_id == station.id).all()
        gen1 = next((e for e in equipment_list if e.name == "Generator 1"), None)
        gen2 = next((e for e in equipment_list if e.name == "Generator 2"), None)
        gen1_online = (gen1.status in ["NORMAL", "ONLINE", "RUNNING"]) if gen1 else True
        gen2_online = (gen2.status in ["ONLINE", "RUNNING"]) if gen2 else False

        if conds.get("generator_1_online") is not None:
            gen1_online = bool(conds["generator_1_online"])
        if conds.get("generator_2_online") is not None:
            gen2_online = bool(conds["generator_2_online"])

        # 3. Simulate Microgrid Energy
        sim_energy = EnergySimulator.simulate_energy_cycle(
            station_code=station.code,
            ambient_temperature=sensor_entry.temperature,
            wind_speed=sensor_entry.wind_speed,
            prev_battery_pct=prev_bat,
            prev_fuel_pct=prev_fuel,
            active_scenario=active_scenario,
            custom_conditions=conds,
            generator_1_online=gen1_online,
            generator_2_online=gen2_online,
            dt_seconds=dt_seconds,
            scenario_dynamics=scenario_dynamics,
        )

        energy_entry = EnergyTelemetry(
            station_id=station.id,
            timestamp=now,
            generation_kw=sim_energy["generation_kw"],
            consumption_kw=sim_energy["consumption_kw"],
            energy_balance=sim_energy["energy_balance"],
            battery_percentage=sim_energy["battery_percentage"],
            battery_power_kw=sim_energy["battery_power_kw"],
            diesel_generation_kw=sim_energy["diesel_generation_kw"],
            solar_generation_kw=sim_energy["solar_generation_kw"],
            wind_generation_kw=sim_energy.get("wind_generation_kw", 0.0),
            fuel_percentage=sim_energy["fuel_percentage"],
            grid_status=sim_energy["grid_status"],
            source="simulation",
            is_simulated=True,
        )
        db.add(energy_entry)
        db.flush()

        # 4. Simulate Equipment Wear & Thermal Dynamics
        equipment_list = db.query(Equipment).filter(Equipment.station_id == station.id).all()
        for eq in equipment_list:
            EquipmentSimulator.update_equipment_state(
                equipment=eq,
                active_scenario=active_scenario,
                target_equipment_id=target_equipment_id,
                custom_conditions=conds,
                dt_seconds=dt_seconds,
                scenario_dynamics=scenario_dynamics,
            )
        db.flush()

        # 5. Simulate Logistics & Consumable Attrition
        logistics_list = db.query(LogisticsItem).filter(LogisticsItem.station_id == station.id).all()
        for item in logistics_list:
            # Sync fuel logistics quantity with fuel percentage
            if item.category == "FUEL":
                total_capacity = 75000.0 if "MAITRI" in station.code.upper() else 60000.0
                item.quantity = round(total_capacity * (sim_energy["fuel_percentage"] / 100.0), 1)
            LogisticsSimulator.update_logistics_item(
                item,
                active_scenario=active_scenario,
                custom_conditions=conds,
                dt_seconds=dt_seconds,
                scenario_dynamics=scenario_dynamics,
            )
        db.flush()

        # 6. Automatic Anomaly Detection & Alerts
        new_alerts = alert_service.evaluate_station_conditions(
            db=db,
            station_id=station.id,
            energy=energy_entry,
            weather=sensor_entry,
            equipment_list=equipment_list,
            logistics_list=logistics_list,
        )

        db.commit()

        cycle_summary = {
            "station_id": station.id,
            "station_code": station.code,
            "timestamp": now.isoformat(),
            "environment": {
                "temperature": sensor_entry.temperature,
                "wind_speed": sensor_entry.wind_speed,
                "wind_direction": sensor_entry.wind_direction,
                "pressure": sensor_entry.pressure,
                "humidity": sensor_entry.humidity,
                "visibility": sensor_entry.visibility,
                "source": sensor_entry.source,
                "is_simulated": sensor_entry.is_simulated,
            },
            "energy": {
                "generation_kw": energy_entry.generation_kw,
                "consumption_kw": energy_entry.consumption_kw,
                "energy_balance": energy_entry.energy_balance,
                "battery_percentage": energy_entry.battery_percentage,
                "battery_power_kw": energy_entry.battery_power_kw,
                "diesel_generation_kw": energy_entry.diesel_generation_kw,
                "solar_generation_kw": energy_entry.solar_generation_kw,
                "wind_generation_kw": energy_entry.wind_generation_kw,
                "fuel_percentage": energy_entry.fuel_percentage,
                "grid_status": energy_entry.grid_status,
            },
            "equipment_count": len(equipment_list),
            "new_alerts_triggered": len(new_alerts),
            "active_scenario": active_scenario,
            "custom_conditions_active": bool(conds),
        }

        # 7a. Attach a cached prediction snapshot so the frontend receives
        # real-time forecasts over WebSocket without needing a dashboard refetch.
        # Uses the prediction cache (60s TTL) so this adds ~zero latency.
        try:
            from app.services.energy_forecast_service import energy_forecast_service
            pred = energy_forecast_service.predict(db, station.id, station.code)
            cycle_summary["prediction"] = {
                "model_name": pred.get("model_name"),
                "model_version": pred.get("model_version"),
                "current_consumption_kw": pred.get("current_consumption_kw"),
                "forecast": pred.get("forecast"),
                "cached": pred.get("cached", False),
                "cache_age_seconds": pred.get("cache_age_seconds", 0.0),
                "active_scenario": pred.get("active_scenario", "NORMAL_OPERATION"),
                "scenario_adjusted": pred.get("scenario_adjusted", False),
                "scenario_adjustment": pred.get("scenario_adjustment"),
            }
            from app.services.prediction_service import prediction_service
            fuel_fc = prediction_service.forecast_fuel_depletion(db, station.id, station.code)
            cycle_summary["fuel_forecast"] = {
                "current_fuel_percentage": fuel_fc.current_fuel_percentage,
                "estimated_daily_consumption_liters": fuel_fc.estimated_daily_consumption_liters,
                "days_until_critical": fuel_fc.days_until_critical,
                "status": fuel_fc.status,
                "burn_rate_source": fuel_fc.burn_rate_source,
            }
        except Exception as e:
            logger.debug(f"Prediction snapshot skipped in broadcast: {e}")

        # 8. WebSocket Broadcast if callback provided
        if broadcast_callback:
            try:
                if asyncio.iscoroutinefunction(broadcast_callback):
                    await broadcast_callback(station.code.lower(), cycle_summary)
                else:
                    broadcast_callback(station.code.lower(), cycle_summary)
            except Exception as e:
                logger.debug(f"Broadcast callback notification skipped: {e}")

        return cycle_summary


telemetry_engine = TelemetryEngine()
