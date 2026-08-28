import math
import random
from datetime import datetime, timezone
from typing import Dict, Optional
from app.utils.validators import clamp_percentage
from app.utils.calculations import calculate_building_thermal_load


class EnergySimulator:
    """
    Physics-based Antarctic microgrid energy simulation engine.
    Models building thermodynamics, solar irradiance, generator governor droop, and battery electrochemical dynamics.
    """

    @staticmethod
    def simulate_energy_cycle(
        station_code: str,
        ambient_temperature: float,
        wind_speed: float,
        prev_battery_pct: float,
        prev_fuel_pct: float,
        active_scenario: str = "NORMAL_OPERATION",
        scenario_params: Optional[Dict] = None,
        custom_conditions: Optional[Dict] = None,
        generator_1_online: Optional[bool] = None,
        generator_2_online: Optional[bool] = None,
        dt_seconds: float = 10.0,
        scenario_dynamics: Optional[Dict] = None,
    ) -> Dict:
        now = datetime.now(timezone.utc)
        # Continuous time in seconds for smooth harmonic cycling
        time_sec = now.timestamp()
        hour = now.hour + (now.minute / 60.0) + (now.second / 3600.0)
        conds = custom_conditions or scenario_params or {}
        sd = scenario_dynamics or {}

        # 1. Base station life support & living quarters load + Thermodynamic heat loss
        is_maitri = "MAITRI" in station_code.upper()
        thermal_res = calculate_building_thermal_load(
            station_code=station_code,
            ambient_temperature=ambient_temperature,
            wind_speed_kmh=wind_speed,
            load_modifier_kw=float(conds.get("load_modifier_kw", 0.0)),
        )
        base_physics_consumption = thermal_res["total_consumption_kw"]

        # HVAC heat pump thermostat cyclic modulation (~3 minute oscillation period)
        hvac_cycling = 2.4 * math.sin(time_sec / 180.0 * 2 * math.pi)
        
        # Scientific equipment & water desalination pump duty cycle (~5 minute period)
        lab_duty_cycle = 1.6 * math.sin((time_sec / 300.0 * 2 * math.pi) + 1.2)
        
        # Realistic electrical noise: Gaussian (not uniform) — real power
        # meters observe normally-distributed switching noise from loads cycling.
        electrical_jitter = random.gauss(0.0, 0.35)

        total_consumption = max(10.0, base_physics_consumption + hvac_cycling + lab_duty_cycle + electrical_jitter)

        # 3. Solar PV Generation Model with Diurnal Curve & Atmospheric Attenuation
        solar_capacity = 60.0 if not is_maitri else 40.0
        if 6.5 <= hour <= 17.5:
            # Solar zenith angle curve
            solar_elevation_factor = math.sin((hour - 6.5) / 11.0 * math.pi)
            # Atmospheric cloud optical density — Gaussian cloud drift (real irradiance sensors
            # see autocorrelated cloud shading, not flat noise)
            cloud_extinction = 1.0 - (0.08 * math.sin(time_sec / 240.0 * 2 * math.pi) + max(0.0, random.gauss(0.02, 0.03)))
            solar_gen = max(0.0, solar_capacity * (solar_elevation_factor ** 1.2) * cloud_extinction)
        else:
            solar_gen = 0.0

        # Apply custom solar factor override (e.g. 0.0 for Polar Night)
        if conds.get("solar_factor") is not None:
            solar_gen = max(0.0, solar_gen * float(conds["solar_factor"]))

        # 3b. Wind Turbine Generation Model
        # Polar-rated vertical-axis turbines: cut-in ~12 km/h, rated ~45 km/h, cut-out ~90 km/h.
        # Power curve: cubic ramp between cut-in and rated, constant above rated until cut-out.
        wind_capacity = 45.0  # kW rated
        cut_in = 12.0          # km/h
        rated = 45.0           # km/h
        cut_out = 90.0         # km/h
        wind_gust_noise = random.gauss(0.0, 1.5)
        effective_wind = max(0.0, wind_speed + wind_gust_noise)

        if effective_wind < cut_in or effective_wind > cut_out:
            wind_gen = 0.0
        elif effective_wind < rated:
            # Cubic power curve: P = P_rated × ((v - v_cut_in) / (v_rated - v_cut_in))^3
            ramp = (effective_wind - cut_in) / (rated - cut_in)
            wind_gen = wind_capacity * (ramp ** 3)
        else:
            # Rated power plateau (with small Gaussian variation for turbulence)
            wind_gen = wind_capacity + random.gauss(0.0, 0.8)
            wind_gen = min(wind_capacity * 1.05, max(0.0, wind_gen))

        # 4. Generator Online Statuses & Scenario Modifiers
        g1_online = True if generator_1_online is None else generator_1_online
        g2_online = False if generator_2_online is None else generator_2_online

        if conds.get("generator_1_online") is not None:
            g1_online = bool(conds["generator_1_online"])
        if conds.get("generator_2_online") is not None:
            g2_online = bool(conds["generator_2_online"])

        if active_scenario == "EXTREME_COLD":
            # Dynamic: add the computed thermal load delta (from actual conditions)
            total_consumption += sd.get("extreme_cold_consumption_delta_kw", 0.0)
        elif active_scenario == "HIGH_ENERGY_DEMAND":
            # Dynamic: extra load computed from actual sheddable loads + science duty
            extra = sd.get("high_demand_extra_load_kw", 55.0)
            total_consumption += (extra + 5.0 * math.sin(time_sec / 120.0))
            g2_online = True # Parallel generator synchronization
        elif active_scenario == "GENERATOR_FAILURE":
            g1_online = False # Primary generator failure trip
        elif active_scenario == "FUEL_SHORTAGE":
            # Dynamic: force fuel to computed target from actual burn rate
            prev_fuel_pct = min(prev_fuel_pct, sd.get("fuel_shortage_target_pct", 12.0))
        elif active_scenario == "EQUIPMENT_DEGRADATION":
            # Dynamic: multiplier from actual average efficiency loss
            total_consumption *= sd.get("equipment_degradation_consumption_mult", 1.08)
        elif active_scenario == "SUPPLY_DELAY":
            # Dynamic: conservation from actual non-critical load fraction
            total_consumption *= sd.get("supply_delay_consumption_mult", 0.95)

        # Custom battery & fuel overrides from conditions
        if conds.get("battery_percentage") is not None:
            prev_battery_pct = float(conds["battery_percentage"])
        if conds.get("fuel_percentage") is not None:
            prev_fuel_pct = float(conds["fuel_percentage"])

        # 5. Diesel Generator Dispatch & Governor Dynamic Regulation
        gen1_max = 120.0 if g1_online else 0.0
        gen2_max = 120.0 if g2_online else 0.0

        # Net load required from diesel microgrid
        net_load_required = max(0.0, total_consumption - solar_gen)

        diesel_gen = 0.0
        battery_power_kw = 0.0

        # Dynamic governor setpoint:
        # If battery is low (<75%), governor commands higher charging headroom (+12 to +18 kW)
        # If battery is nominal (75-90%), governor commands moderate trickle (+3 to +8 kW)
        # If battery is high (>90%), governor commands near-unity (+1 to +4 kW)
        # Using Gaussian noise (real governor controllers have normally-distributed jitter)
        if prev_battery_pct < 75.0:
            target_buffer = 12.5 + random.gauss(0.0, 1.5)
        elif prev_battery_pct < 90.0:
            target_buffer = 4.5 + 2.0 * math.sin(time_sec / 90.0) + random.gauss(0.0, 0.5)
        else:
            target_buffer = 2.0 + 1.2 * math.sin(time_sec / 90.0) + random.gauss(0.0, 0.3)

        if net_load_required > 0:
            if g1_online and g2_online:
                # Dual generator load sharing (50/50 balance)
                combined_target = net_load_required + target_buffer
                diesel_gen = min(gen1_max + gen2_max, combined_target)
            elif g1_online:
                # Primary generator carrying microgrid
                diesel_gen = min(gen1_max, net_load_required + target_buffer)
            elif g2_online:
                # Backup generator carrying microgrid
                # When backup is dispatched during failure, it modulates around base demand
                backup_buffer = 1.5 + 1.8 * math.sin(time_sec / 60.0) + random.gauss(0.0, 0.4)
                diesel_gen = min(gen2_max, net_load_required + backup_buffer)
            else:
                # Both generators offline -> zero generation, battery buffers total station demand
                diesel_gen = 0.0

        total_generation = round(solar_gen + diesel_gen + wind_gen, 2)
        total_consumption = round(max(20.0, total_consumption), 2)
        energy_balance = round(total_generation - total_consumption, 2)

        # 6. Electrochemical Battery Dynamics (SoC Integration)
        # Bharati: 300 kWh bank (~1000 Ah @ 300V), Maitri: 350 kWh bank
        battery_capacity_kwh = 350.0 if is_maitri else 300.0

        if energy_balance >= 0:
            # Battery charging (charge power limited by BMS C-rate, max 35 kW)
            charge_power = min(35.0, energy_balance)
            battery_power_kw = charge_power
            coulombic_eff = 0.91 # 91% electrochemical roundtrip efficiency
            delta_kwh = (charge_power * (dt_seconds / 3600.0)) * coulombic_eff
            new_battery_pct = prev_battery_pct + (delta_kwh / battery_capacity_kwh * 100.0)
        else:
            # Battery discharging to support microgrid deficit
            discharge_power = abs(energy_balance)
            battery_power_kw = -1.0 * discharge_power
            internal_r_loss = 0.94 # 94% discharge discharge factor
            delta_kwh = (discharge_power * (dt_seconds / 3600.0)) / internal_r_loss
            new_battery_pct = prev_battery_pct - (delta_kwh / battery_capacity_kwh * 100.0)

        new_battery_pct = round(clamp_percentage(new_battery_pct), 2)

        # 7. Fuel Consumption Dynamics
        # Specific Fuel Consumption (BSFC) ~ 0.245 - 0.265 L/kWh depending on generator loading percentage
        total_fuel_capacity_liters = 75000.0 if is_maitri else 60000.0
        load_factor = (diesel_gen / 120.0) if diesel_gen > 0 else 0.0
        bsfc = 0.255 + (0.02 * (1.0 - load_factor)) if load_factor > 0 else 0.255
        fuel_burn_mult = float(conds.get("fuel_burn_multiplier", 1.0))
        liters_consumed = (diesel_gen * (dt_seconds / 3600.0)) * bsfc * fuel_burn_mult
        fuel_pct_decrement = (liters_consumed / total_fuel_capacity_liters) * 100.0
        new_fuel_pct = round(clamp_percentage(prev_fuel_pct - fuel_pct_decrement), 2)

        # 8. Grid Status Classification
        if not g1_online and not g2_online:
            grid_status = "EMERGENCY"
        elif not g1_online or new_battery_pct < 20.0 or energy_balance < -20.0:
            grid_status = "DEGRADED"
        elif active_scenario != "NORMAL_OPERATION":
            grid_status = "ISLANDED"
        else:
            grid_status = "ONLINE"

        return {
            "generation_kw": total_generation,
            "consumption_kw": total_consumption,
            "energy_balance": energy_balance,
            "battery_percentage": new_battery_pct,
            "battery_power_kw": round(battery_power_kw, 2),
            "diesel_generation_kw": round(diesel_gen, 2),
            "solar_generation_kw": round(solar_gen, 2),
            "wind_generation_kw": round(wind_gen, 2),
            "fuel_percentage": new_fuel_pct,
            "grid_status": grid_status,
        }
