from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from app.core.station_profiles import get_station_profile


def calculate_energy_balance(generation_kw: float, consumption_kw: float) -> float:
    """Calculates generation - consumption (kW)."""
    return round(float(generation_kw) - float(consumption_kw), 2)


def calculate_days_remaining(quantity: float, daily_consumption: float) -> float:
    """Calculates quantity / daily_consumption safely avoiding division by zero."""
    if daily_consumption <= 0:
        return 999.0  # Infinite/no consumption
    if quantity <= 0:
        return 0.0
    return round(quantity / daily_consumption, 1)


def calculate_equipment_health(
    name: str,
    equipment_type: str,
    temperature: float,
    runtime_hours: float,
    efficiency: float,
    last_maintenance: Optional[datetime] = None,
    nominal_temp: float = 65.0,
    is_faulty: bool = False,
) -> Dict:
    """
    Deterministic baseline scoring algorithm for equipment health.
    Considers temperature, runtime, efficiency, and maintenance age.
    """
    factors: List[str] = []
    recommendation: str = "System operating within optimal parameters."

    # 1. Temperature evaluation
    temp_penalty = 0.0
    if temperature > (nominal_temp + 20.0):
        temp_penalty = 35.0
        factors.append(f"Critical thermal threshold exceeded ({temperature:.1f}°C vs nominal {nominal_temp:.1f}°C)")
    elif temperature > (nominal_temp + 10.0):
        temp_penalty = 20.0
        factors.append(f"Elevated operating temperature ({temperature:.1f}°C)")
    elif temperature > nominal_temp:
        temp_penalty = 8.0
        factors.append(f"Slightly above nominal operating temperature ({temperature:.1f}°C)")

    # 2. Efficiency evaluation
    eff_penalty = 0.0
    if efficiency < 70.0:
        eff_penalty = 30.0
        factors.append(f"Severely degraded operating efficiency ({efficiency:.1f}%)")
    elif efficiency < 85.0:
        eff_penalty = 15.0
        factors.append(f"Suboptimal operating efficiency ({efficiency:.1f}%)")

    # 3. Runtime hours evaluation
    runtime_penalty = 0.0
    if runtime_hours > 6000:
        runtime_penalty = 25.0
        factors.append(f"High cumulative runtime ({runtime_hours:.0f} hrs)")
    elif runtime_hours > 3000:
        runtime_penalty = 10.0
        factors.append(f"Moderate cumulative runtime ({runtime_hours:.0f} hrs)")

    # 4. Maintenance age evaluation
    maint_penalty = 0.0
    if last_maintenance:
        # ensure timezone awareness
        now = datetime.now(timezone.utc)
        if last_maintenance.tzinfo is None:
            last_maint_tz = last_maintenance.replace(tzinfo=timezone.utc)
        else:
            last_maint_tz = last_maintenance
        days_since_maint = (now - last_maint_tz).days
        if days_since_maint > 180:
            maint_penalty = 20.0
            factors.append(f"Routine maintenance overdue ({days_since_maint} days since last service)")
        elif days_since_maint > 120:
            maint_penalty = 10.0
            factors.append(f"Routine maintenance due soon ({days_since_maint} days since last service)")

    # Baseline calculation
    raw_health = 100.0 - (temp_penalty + eff_penalty + runtime_penalty + maint_penalty)
    if is_faulty:
        raw_health = min(raw_health, 25.0)
        factors.append("Mechanical/Electrical trip or anomaly detected")

    health_score = round(max(0.0, min(100.0, raw_health)), 1)

    # Status classification
    if health_score < 30.0:
        status = "CRITICAL"
        recommendation = "Immediate shutdown, inspection, or dispatch backup asset required."
    elif health_score < 60.0:
        status = "WARNING"
        recommendation = "Schedule prioritized maintenance and reduce operational load."
    else:
        status = "NORMAL"
        if factors:
            recommendation = "Monitor system parameters and schedule routine servicing."

    return {
        "equipment": name,
        "equipment_type": equipment_type,
        "health_score": health_score,
        "status": status,
        "factors": factors if factors else ["All monitored telemetry within nominal bounds."],
        "recommendation": recommendation,
    }


def calculate_building_thermal_load(
    station_code: str,
    ambient_temperature: float,
    wind_speed_kmh: float,
    load_modifier_kw: float = 0.0,
    indoor_setpoint_c: float = 18.0,
) -> Dict[str, float]:
    """
    Thermodynamic building heat loss & electrical demand model for Antarctic research stations.
    
    Physics components:
    1. Indoor habitability setpoint (standard ASHRAE/Antarctic habitat: 18.0°C).
    2. Delta T = max(0, T_indoor - T_ambient).
    3. Fourier conduction envelope loss: Q_cond = (U * A) * Delta T.
       Bharati: composite envelope ~0.48 kW/K. Maitri: ~0.58 kW/K.
    4. Forced convection multiplier via wind boundary layer: (1 + 0.045 * (v / 10)^0.8).
    5. Ventilation & fresh air infiltration exchange: Q_vent ~ 0.32 kW/K (Bharati), 0.38 kW/K (Maitri).
    6. Heat pump COP = max(1.0, 1.85 - 0.02 * max(0, -T_ambient - 10.0)).
    7. Base electrical load (scientific instruments, water pumps, lighting, server comms):
       Bharati: 54.0 kW, Maitri: 62.0 kW.
    """
    profile = get_station_profile(station_code)
    base_electrical = profile.base_electrical_load_kw
    u_envelope = profile.thermal_envelope_u
    vent_coeff = profile.ventilation_coeff

    delta_t = max(0.0, indoor_setpoint_c - ambient_temperature)
    wind_clamped = max(0.0, wind_speed_kmh)
    wind_multiplier = 1.0 + 0.045 * ((wind_clamped / 10.0) ** 0.8)

    q_conduction = u_envelope * delta_t * wind_multiplier
    q_ventilation = vent_coeff * delta_t
    total_thermal_demand = q_conduction + q_ventilation

    # Heat pump COP degradation curve with extreme sub-zero ambient
    cop = max(1.0, 1.85 - 0.02 * max(0.0, -ambient_temperature - 10.0))
    heating_electrical_kw = total_thermal_demand / cop

    total_consumption = base_electrical + heating_electrical_kw + load_modifier_kw

    return {
        "base_electrical_kw": round(base_electrical, 2),
        "thermal_delta_c": round(delta_t, 2),
        "heating_electrical_kw": round(heating_electrical_kw, 2),
        "total_consumption_kw": round(max(10.0, total_consumption), 2),
    }


def calculate_microgrid_power_flow(
    station_code: str,
    consumption_kw: float,
    solar_factor: float = 0.5,
    generator_1_online: bool = True,
    generator_2_online: bool = False,
    initial_battery_pct: float = 85.0,
    fuel_pct: float = 82.0,
    fuel_burn_multiplier: float = 1.0,
    duration_minutes: float = 60.0,
    hour_of_day: Optional[float] = None,
) -> Dict:
    """
    Rigorous Microgrid dispatch, electrochemical battery storage, and fuel logistics model.
    """
    import math

    profile = get_station_profile(station_code)
    solar_peak_capacity = profile.solar_peak_capacity_kw
    battery_capacity_kwh = profile.battery_capacity_kwh
    fuel_tank_capacity_liters = profile.fuel_tank_capacity_liters

    # 1. Solar generation calculation
    if hour_of_day is not None:
        zenith = max(0.0, math.sin((hour_of_day - 6.0) / 12.0 * math.pi))
    else:
        zenith = 0.75  # Nominal daylight average
    solar_kw = round(solar_peak_capacity * max(0.0, min(1.0, solar_factor)) * zenith, 2)

    # 2. Generator dispatch & rating
    net_demand_for_diesel = max(0.0, consumption_kw - solar_kw)
    gen_unit_capacity = profile.generator_rated_kw

    if generator_1_online and generator_2_online:
        total_gen_cap = 240.0
        # Generators share load equally
        diesel_generation_kw = min(total_gen_cap, net_demand_for_diesel)
    elif generator_1_online or generator_2_online:
        total_gen_cap = 120.0
        diesel_generation_kw = min(total_gen_cap, net_demand_for_diesel)
    else:
        total_gen_cap = 0.0
        diesel_generation_kw = 0.0

    total_generation_kw = round(solar_kw + diesel_generation_kw, 2)
    net_balance_kw = round(total_generation_kw - consumption_kw, 2)
    energy_deficit_kw = round(max(0.0, -net_balance_kw), 2)

    # 3. Battery electrochemical dynamics
    eta_discharge = 0.95
    eta_charge = 0.92
    max_charge_kw = 35.0
    max_discharge_kw = 60.0

    duration_hours = max(0.01, duration_minutes / 60.0)

    if energy_deficit_kw > 0:
        actual_discharge_kw = min(max_discharge_kw, energy_deficit_kw)
        kwh_drained = (actual_discharge_kw * duration_hours) / eta_discharge
        battery_drop_pct = min(initial_battery_pct, (kwh_drained / battery_capacity_kwh) * 100.0)
        # Avoid negative zero or micro-jitter
        battery_drop_pct = round(battery_drop_pct, 1)
        if battery_drop_pct < 0.05:
            battery_drop_pct = 0.0
        final_battery_pct = round(max(0.0, initial_battery_pct - battery_drop_pct), 1)

        # Hours until blackout / battery depletion
        hours_to_blackout = (
            ((initial_battery_pct / 100.0) * battery_capacity_kwh * eta_discharge) / actual_discharge_kw
            if actual_discharge_kw > 0 else 999.0
        )
    else:
        actual_charge_kw = min(max_charge_kw, max(0.0, net_balance_kw))
        kwh_stored = actual_charge_kw * duration_hours * eta_charge
        battery_gain_pct = (kwh_stored / battery_capacity_kwh) * 100.0
        battery_drop_pct = 0.0
        final_battery_pct = round(min(100.0, initial_battery_pct + battery_gain_pct), 1)
        hours_to_blackout = 999.0

    # 4. Fuel burn & logistics dynamics
    # Brake Specific Fuel Consumption (BSFC) curve (L/kWh)
    load_factor = (diesel_generation_kw / total_gen_cap) if total_gen_cap > 0 else 0.0
    bsfc = 0.250 + 0.020 * (1.0 - load_factor)
    hourly_fuel_liters = diesel_generation_kw * bsfc * fuel_burn_multiplier
    daily_fuel_liters = hourly_fuel_liters * 24.0

    current_fuel_liters = fuel_tank_capacity_liters * (fuel_pct / 100.0)
    fuel_drained_over_window = hourly_fuel_liters * duration_hours
    projected_final_fuel_pct = round(
        max(0.0, ((current_fuel_liters - fuel_drained_over_window) / fuel_tank_capacity_liters) * 100.0), 1
    )
    days_of_fuel_remaining = (
        round(current_fuel_liters / daily_fuel_liters, 1) if daily_fuel_liters > 0 else 999.0
    )

    # 5. Precise Risk Index Classification
    if (not generator_1_online and not generator_2_online) or final_battery_pct < 15.0 or energy_deficit_kw > 50.0:
        grid_risk = "CRITICAL"
    elif not generator_1_online or energy_deficit_kw > 20.0 or final_battery_pct < 30.0 or projected_final_fuel_pct < 20.0:
        grid_risk = "HIGH RISK"
    elif energy_deficit_kw > 0.0 or hours_to_blackout < 48.0 or projected_final_fuel_pct < 35.0:
        grid_risk = "ELEVATED"
    else:
        grid_risk = "NOMINAL"

    return {
        "solar_generation_kw": solar_kw,
        "diesel_generation_kw": diesel_generation_kw,
        "total_generation_kw": total_generation_kw,
        "consumption_kw": consumption_kw,
        "net_balance_kw": net_balance_kw,
        "energy_deficit_kw": energy_deficit_kw,
        "battery_drop_pct": battery_drop_pct,
        "final_battery_pct": final_battery_pct,
        "hours_to_blackout": round(hours_to_blackout, 1),
        "hourly_fuel_burn_liters": round(hourly_fuel_liters, 2),
        "daily_fuel_burn_liters": round(daily_fuel_liters, 1),
        "days_of_fuel_remaining": days_of_fuel_remaining,
        "projected_final_fuel_pct": projected_final_fuel_pct,
        "grid_risk": grid_risk,
    }
