import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, List, Optional, Union
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.station import Station
from app.models.equipment import Equipment
from app.services.station_service import station_service
from app.simulation.telemetry_engine import telemetry_engine
from app.schemas.simulation import ScenarioRequest, ScenarioResponse, SimulationStatusOut
from app.utils.calculations import calculate_building_thermal_load, calculate_microgrid_power_flow

logger = logging.getLogger(__name__)


class SimulationService:
    def __init__(self):
        self.is_running: bool = settings.SIMULATION_ENABLED
        self.interval_seconds: int = settings.SIMULATION_INTERVAL_SECONDS
        self.active_scenarios: Dict[str, str] = {} # station_code -> scenario
        self.active_conditions: Dict[str, Optional[Dict]] = {} # station_code -> custom_conditions dict
        self.scenario_expiries: Dict[str, Optional[datetime]] = {}
        self.target_equipment_ids: Dict[str, Optional[int]] = {}
        self.total_cycles_executed: int = 0
        self.last_tick_at: Optional[datetime] = None
        self.broadcast_callback: Optional[Callable] = None

    def set_broadcast_callback(self, callback: Callable):
        self.broadcast_callback = callback

    def start(self) -> bool:
        self.is_running = True
        logger.info("Digital Twin simulation engine started.")
        return self.is_running

    def stop(self) -> bool:
        self.is_running = False
        logger.info("Digital Twin simulation engine paused.")
        return self.is_running

    def reset(self, db: Session) -> Dict[str, str]:
        """Resets all active scenarios back to deterministic NORMAL_OPERATION baseline."""
        from app.models.energy import EnergyTelemetry
        from app.models.sensor import SensorTelemetry
        from app.models.alert import Alert
        from app.utils.calculations import calculate_days_remaining
        from app.services.weather_service import weather_service

        weather_service.clear_cache()
        now = datetime.now(timezone.utc)
        stations = db.query(Station).all()
        for st in stations:
            code = st.code.upper()
            self.active_scenarios[code] = "NORMAL_OPERATION"
            self.active_conditions[code] = None
            self.scenario_expiries[code] = None
            self.target_equipment_ids[code] = None

            # 1. Reset equipment statuses
            for eq in st.equipment:
                eq.status = "NORMAL"
                eq.health_score = 95.0
                eq.efficiency = 94.0
                if eq.equipment_type == "GENERATOR":
                    eq.temperature = 72.0
                elif eq.equipment_type == "HVAC":
                    eq.temperature = 42.0
                else:
                    eq.temperature = 22.0

            # 2. Reset logistics inventory
            for item in st.logistics:
                if item.category == "FUEL":
                    total_cap = 75000.0 if "MAITRI" in code else 60000.0
                    item.quantity = total_cap * 0.82
                item.days_remaining = calculate_days_remaining(item.quantity, item.daily_consumption)
                item.status = "NORMAL"

            # 3. Insert baseline nominal telemetry
            base_gen = 150.0 if "MAITRI" in code else 135.0
            base_con = 110.0 if "MAITRI" in code else 95.0
            db.add(
                EnergyTelemetry(
                    station_id=st.id,
                    timestamp=now,
                    generation_kw=base_gen,
                    consumption_kw=base_con,
                    energy_balance=round(base_gen - base_con, 2),
                    battery_percentage=85.0,
                    battery_power_kw=15.0,
                    diesel_generation_kw=base_gen - 30.0,
                    solar_generation_kw=30.0,
                    fuel_percentage=82.0,
                    grid_status="ONLINE",
                    source="reset_baseline",
                    is_simulated=True,
                )
            )

            db.add(
                SensorTelemetry(
                    station_id=st.id,
                    timestamp=now,
                    temperature=-18.0 if "MAITRI" in code else -14.0,
                    wind_speed=32.0,
                    wind_direction=165.0,
                    pressure=990.0,
                    humidity=62.0,
                    precipitation=0.0,
                    visibility=10.0,
                    source="reset_baseline",
                    is_simulated=True,
                )
            )

            # 4. Resolve active failure alerts
            active_alerts = db.query(Alert).filter(Alert.station_id == st.id, Alert.acknowledged == False).all()
            for al in active_alerts:
                al.acknowledged = True
                al.resolved_at = now

            # 5. Restore all electrical load circuits
            from app.models.audit import LoadGroup
            station_loads = db.query(LoadGroup).filter(LoadGroup.station_id == st.id).all()
            for lg in station_loads:
                lg.enabled = True

        db.commit()
        logger.info("Simulation state reset to deterministic NORMAL_OPERATION for all stations.")
        # Clear prediction cache so forecasts revert immediately.
        try:
            from app.services.energy_forecast_service import energy_forecast_service
            energy_forecast_service.clear_prediction_cache()
        except Exception:
            pass
        return {"status": "SUCCESS", "message": "All station simulations reset to NORMAL_OPERATION."}

    def get_status(self) -> SimulationStatusOut:
        return SimulationStatusOut(
            is_running=self.is_running,
            interval_seconds=self.interval_seconds,
            last_tick_at=self.last_tick_at,
            active_scenarios=self.active_scenarios,
            active_scenario_expiry=self.scenario_expiries,
            total_cycles_executed=self.total_cycles_executed,
            active_custom_conditions=self.active_conditions,
        )

    def evaluate_what_if_scenario(
        self,
        db: Session,
        station: Station,
        scenario: str,
        equipment_id: Optional[int] = None,
        duration_minutes: int = 60,
        custom_conditions: Optional[Dict] = None,
    ) -> ScenarioResponse:
        """
        Calculates projected impact of a What-If scenario or custom conditions on energy deficit,
        battery level drop, fuel consumption, affected systems, and operational recommendations.
        """
        scenario_upper = scenario.upper()
        now = datetime.now(timezone.utc)
        active_until = now + timedelta(minutes=duration_minutes)

        # Compute dynamic scenario parameters from actual station state
        from app.simulation.telemetry_engine import compute_scenario_dynamics
        from app.models.energy import EnergyTelemetry
        from app.models.sensor import SensorTelemetry
        latest_e = db.query(EnergyTelemetry).filter(EnergyTelemetry.station_id == station.id).order_by(EnergyTelemetry.timestamp.desc()).first()
        latest_s = db.query(SensorTelemetry).filter(SensorTelemetry.station_id == station.id).order_by(SensorTelemetry.timestamp.desc()).first()
        _cur_t = float(latest_s.temperature) if latest_s else (-18.0 if is_maitri else -14.0)
        _cur_w = float(latest_s.wind_speed) if latest_s else 30.0
        _cur_c = float(latest_e.consumption_kw) if latest_e else 100.0
        _cur_d = float(latest_e.diesel_generation_kw) if latest_e else 80.0
        _cur_f = float(latest_e.fuel_percentage) if latest_e else 75.0
        sd = compute_scenario_dynamics(db, station, scenario_upper, _cur_t, _cur_w, _cur_c, _cur_d, _cur_f)

        target_eq_name = None
        if equipment_id:
            eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
            if eq:
                target_eq_name = eq.name

        impact: Dict[str, Union[float, int, str, bool]] = {}
        affected_systems: List[str] = []
        recommendations: List[str] = []
        is_maitri = "MAITRI" in station.code.upper()

        if scenario_upper == "CUSTOM" or custom_conditions:
            conds = custom_conditions or {}

            temp = float(conds.get("temperature_c", -18.0 if is_maitri else -14.0))
            wind = float(conds.get("wind_speed_kmh", 30.0))
            load_mod = float(conds.get("load_modifier_kw", 0.0))
            solar_fac = float(conds.get("solar_factor", 0.5))
            g1_on = bool(conds.get("generator_1_online", True))
            g2_on = bool(conds.get("generator_2_online", False))
            bat_pct = float(conds.get("battery_percentage", 85.0))
            fuel_pct = float(conds.get("fuel_percentage", 82.0))
            fuel_mult = float(conds.get("fuel_burn_multiplier", 1.0))

            # 1. Rigorous Building Thermodynamics
            thermal_calc = calculate_building_thermal_load(
                station_code=station.code,
                ambient_temperature=temp,
                wind_speed_kmh=wind,
                load_modifier_kw=load_mod,
            )
            projected_consumption = thermal_calc["total_consumption_kw"]

            # 2. Rigorous Microgrid Dispatch & Battery Dynamics
            flow_calc = calculate_microgrid_power_flow(
                station_code=station.code,
                consumption_kw=projected_consumption,
                solar_factor=solar_fac,
                generator_1_online=g1_on,
                generator_2_online=g2_on,
                initial_battery_pct=bat_pct,
                fuel_pct=fuel_pct,
                fuel_burn_multiplier=fuel_mult,
                duration_minutes=float(duration_minutes),
            )

            impact = {
                "projected_consumption_kw": flow_calc["consumption_kw"],
                "projected_generation_kw": flow_calc["total_generation_kw"],
                "energy_deficit_kw": flow_calc["energy_deficit_kw"],
                "battery_drop_percent": flow_calc["battery_drop_pct"],
                "projected_final_battery_percent": flow_calc["final_battery_pct"],
                "fuel_burn_multiplier": fuel_mult,
                "fuel_reserve_percent": flow_calc["projected_final_fuel_pct"],
                "grid_stability_risk": flow_calc["grid_risk"],
            }

            # Identify affected systems dynamically and accurately
            if not g1_on:
                affected_systems.append("Primary Generator 1 (Offline)")
            if not g2_on and not g1_on:
                affected_systems.append("Backup Generator 2 (Offline)")
            if flow_calc["energy_deficit_kw"] > 0:
                affected_systems.extend(["Microgrid Power Distribution", "Battery Energy Storage Bank"])
            if temp < -30.0 or wind > 70.0 or conds.get("blizzard_warning"):
                affected_systems.extend(["Station HVAC & Life Support", "Exterior Building Thermal Envelope"])
            if load_mod > 25.0:
                affected_systems.append("High-Demand Scientific Circuits")
            if flow_calc["projected_final_fuel_pct"] < 25.0 or fuel_mult > 1.25:
                affected_systems.append("Diesel Fuel Reserves & Winter Supply")
            if conds.get("target_equipment_id"):
                eq_state = str(conds.get("equipment_state", "")).upper()
                eq_eff = conds.get("equipment_efficiency")
                if eq_state in ["WARNING", "CRITICAL", "OFFLINE", "DEGRADED"] or (eq_eff is not None and float(eq_eff) < 85.0):
                    target_eq = db.query(Equipment).filter(Equipment.id == conds["target_equipment_id"]).first()
                    if target_eq:
                        status_str = f" ({eq_state})" if eq_state else ""
                        affected_systems.append(f"Equipment #{target_eq.id}: {target_eq.name}{status_str}")
            if not affected_systems:
                affected_systems.append("All Station Subsystems Nominal")

            # Prioritized operational recommendations
            if not g1_on and not g2_on:
                recommendations.append("EMERGENCY: Immediate black-start procedure required. Manually dispatch Generator 2.")
                recommendations.append("EMERGENCY: Execute station-wide load shedding (SHED_NON_CRITICAL) immediately.")
            elif not g1_on:
                recommendations.append("Recommendation: Dispatch and synchronize backup Generator 2 to restore microgrid capacity.")
            if flow_calc["energy_deficit_kw"] > 0 and g1_on and not g2_on:
                recommendations.append("Recommendation: Synchronize Generator 2 to parallel bus to cover net energy deficit.")
            if flow_calc["energy_deficit_kw"] > 0:
                recommendations.append("Recommendation: Shed non-essential laboratory and auxiliary loads to slow battery drain.")
            if temp < -35.0:
                recommendations.append("Recommendation: Energize fuel line trace heaters to prevent cold-temperature paraffin gelling.")
                recommendations.append("Recommendation: Activate secondary living quarters heating loop.")
            if conds.get("blizzard_warning") or wind > 85.0:
                recommendations.append("Recommendation: Issue red blizzard alert, suspend all outdoor traverses, and seal airlocks.")
            if flow_calc["projected_final_fuel_pct"] < 20.0 or fuel_mult > 1.4:
                recommendations.append("Recommendation: Initiate Tier-1 Fuel Rationing protocol and request priority resupply.")
            if not recommendations:
                recommendations.append("Recommendation: Conditions are within design tolerances. Continue autonomous monitoring.")

        elif scenario_upper == "GENERATOR_FAILURE":
            # Dynamic: use actual current temperature, not hardcoded
            thermal_calc = calculate_building_thermal_load(station.code, _cur_t, _cur_w)
            flow_calc = calculate_microgrid_power_flow(
                station_code=station.code,
                consumption_kw=thermal_calc["total_consumption_kw"],
                solar_factor=0.3,
                generator_1_online=False,
                generator_2_online=False,
                duration_minutes=float(duration_minutes),
            )
            impact = {
                "projected_consumption_kw": flow_calc["consumption_kw"],
                "projected_generation_kw": flow_calc["total_generation_kw"],
                "energy_deficit_kw": flow_calc["energy_deficit_kw"],
                "battery_drop_percent": flow_calc["battery_drop_pct"],
                "projected_final_battery_percent": flow_calc["final_battery_pct"],
                "fuel_burn_multiplier": 1.0,
                "fuel_reserve_percent": flow_calc["projected_final_fuel_pct"],
                "grid_stability_risk": flow_calc["grid_risk"],
            }
            affected_systems = ["Primary Generator 1 (Offline)", "Microgrid Power Distribution", "Battery Energy Storage Bank"]
            recommendations = [
                "Recommendation: Operator should dispatch and start backup Generator 2 to restore microgrid generation capacity.",
                "Recommendation: Shed non-essential laboratory and auxiliary electrical loads to reduce battery discharge rate.",
                "Recommendation: Verify battery state-of-charge to ensure black-start reserve threshold (>10%) is maintained.",
            ]

        elif scenario_upper == "EXTREME_COLD":
            # Dynamic: target temp/wind from historical distribution
            target_t = sd.get("extreme_cold_target_temp", -45.0)
            target_w = sd.get("extreme_cold_target_wind", 90.0)
            thermal_calc = calculate_building_thermal_load(station.code, target_t, target_w)
            flow_calc = calculate_microgrid_power_flow(
                station_code=station.code,
                consumption_kw=thermal_calc["total_consumption_kw"],
                solar_factor=0.05,
                generator_1_online=True,
                generator_2_online=False,
                duration_minutes=float(duration_minutes),
            )
            # Dynamic fuel multiplier from actual thermal load increase
            cold_delta = sd.get("extreme_cold_consumption_delta_kw", 20.0)
            base_con = max(1.0, _cur_c)
            fuel_mult = round(1.0 + (cold_delta / base_con) * 0.8, 2)
            impact = {
                "temperature_drop_celsius": round(target_t - _cur_t, 1),
                "projected_consumption_kw": flow_calc["consumption_kw"],
                "projected_generation_kw": flow_calc["total_generation_kw"],
                "energy_deficit_kw": flow_calc["energy_deficit_kw"],
                "battery_drop_percent": flow_calc["battery_drop_pct"],
                "projected_final_battery_percent": flow_calc["final_battery_pct"],
                "fuel_burn_multiplier": fuel_mult,
                "fuel_reserve_percent": flow_calc["projected_final_fuel_pct"],
                "grid_stability_risk": flow_calc["grid_risk"],
            }
            affected_systems = ["HVAC Heating & Ventilation", "Diesel Fuel Reserves", "Exterior Building Thermal Envelope"]
            recommendations = [
                "Recommendation: Activate secondary auxiliary heating loop in living quarters.",
                "Recommendation: Ensure fuel pipe heat-tracing cables are energized to prevent paraffin gelling.",
                "Recommendation: Prepare emergency Arctic survival pods and suspend all outdoor traverse missions.",
            ]

        elif scenario_upper == "HIGH_ENERGY_DEMAND":
            # Dynamic: extra load from actual sheddable loads
            extra_load = sd.get("high_demand_extra_load_kw", 55.0)
            thermal_calc = calculate_building_thermal_load(station.code, _cur_t, _cur_w, load_modifier_kw=extra_load)
            flow_calc = calculate_microgrid_power_flow(
                station_code=station.code,
                consumption_kw=thermal_calc["total_consumption_kw"],
                solar_factor=0.4,
                generator_1_online=True,
                generator_2_online=False,
                duration_minutes=float(duration_minutes),
            )
            # Dynamic fuel multiplier from actual extra demand
            fuel_mult = round(1.0 + (extra_load / max(1.0, _cur_c)) * 0.5, 2)
            impact = {
                "projected_consumption_kw": flow_calc["consumption_kw"],
                "projected_generation_kw": flow_calc["total_generation_kw"],
                "energy_deficit_kw": flow_calc["energy_deficit_kw"],
                "battery_drop_percent": flow_calc["battery_drop_pct"],
                "projected_final_battery_percent": flow_calc["final_battery_pct"],
                "fuel_burn_multiplier": fuel_mult,
                "fuel_reserve_percent": flow_calc["projected_final_fuel_pct"],
                "grid_stability_risk": flow_calc["grid_risk"],
            }
            affected_systems = ["Power Distribution Grid", "Generator Loading", "High-Demand Scientific Circuits"]
            recommendations = [
                "Recommendation: Synchronize Generator 1 and Generator 2 for parallel bus operation.",
                "Recommendation: Stagger high-power deep ice core drilling equipment operations.",
            ]

        elif scenario_upper == "FUEL_SHORTAGE":
            # Dynamic: target fuel from actual burn rate and logistics
            fuel_target = sd.get("fuel_shortage_target_pct", 12.0)
            thermal_calc = calculate_building_thermal_load(station.code, _cur_t, _cur_w)
            flow_calc = calculate_microgrid_power_flow(
                station_code=station.code,
                consumption_kw=thermal_calc["total_consumption_kw"],
                solar_factor=0.3,
                generator_1_online=True,
                generator_2_online=False,
                fuel_pct=fuel_target,
                duration_minutes=float(duration_minutes),
            )
            impact = {
                "projected_consumption_kw": flow_calc["consumption_kw"],
                "projected_generation_kw": flow_calc["total_generation_kw"],
                "energy_deficit_kw": flow_calc["energy_deficit_kw"],
                "battery_drop_percent": flow_calc["battery_drop_pct"],
                "projected_final_battery_percent": flow_calc["final_battery_pct"],
                "fuel_burn_multiplier": 1.0,
                "fuel_reserve_percent": fuel_target,
                "grid_stability_risk": "HIGH RISK",
            }
            affected_systems = ["Diesel Fuel Reserves & Winter Supply", "Thermal Life Support", "Diesel Power Generation"]
            recommendations = [
                "Recommendation: Initiate Tier-1 Emergency Fuel Conservation Protocol immediately.",
                "Recommendation: Lower ambient room temperatures in unoccupied station zones by 4°C.",
                "Recommendation: Request priority aerial resupply delivery from Cape Town / Maitri logistics corridor.",
            ]

        elif scenario_upper == "EQUIPMENT_DEGRADATION":
            # Dynamic: consumption multiplier from actual efficiency loss
            deg_mult = sd.get("equipment_degradation_consumption_mult", 1.08)
            thermal_calc = calculate_building_thermal_load(station.code, _cur_t, _cur_w)
            adjusted_con = thermal_calc["total_consumption_kw"] * deg_mult
            flow_calc = calculate_microgrid_power_flow(
                station_code=station.code,
                consumption_kw=adjusted_con,
                solar_factor=0.3,
                generator_1_online=True,
                generator_2_online=False,
                duration_minutes=float(duration_minutes),
            )
            # Dynamic fuel multiplier from efficiency loss
            fuel_mult = round(1.0 + (deg_mult - 1.0) * 2.0, 2)
            impact = {
                "projected_consumption_kw": flow_calc["consumption_kw"],
                "projected_generation_kw": flow_calc["total_generation_kw"],
                "energy_deficit_kw": flow_calc["energy_deficit_kw"],
                "battery_drop_percent": flow_calc["battery_drop_pct"],
                "projected_final_battery_percent": flow_calc["final_battery_pct"],
                "fuel_burn_multiplier": fuel_mult,
                "fuel_reserve_percent": flow_calc["projected_final_fuel_pct"],
                "grid_stability_risk": "ELEVATED",
            }
            affected_systems = ["HVAC Heat Pump System", "Primary Generator", "Thermal Management"]
            recommendations = [
                "Recommendation: Schedule immediate mechanical maintenance window during favorable weather.",
                "Recommendation: Inspect filter elements, lube oil pressure, and cooling water heat exchangers.",
            ]

        elif scenario_upper == "SUPPLY_DELAY":
            # Dynamic: compute conservation consumption and logistics impact
            conserv_mult = sd.get("supply_delay_consumption_mult", 0.95)
            thermal_calc = calculate_building_thermal_load(station.code, _cur_t, _cur_w)
            adjusted_con = thermal_calc["total_consumption_kw"] * conserv_mult
            flow_calc = calculate_microgrid_power_flow(
                station_code=station.code,
                consumption_kw=adjusted_con,
                solar_factor=0.3,
                generator_1_online=True,
                generator_2_online=False,
                duration_minutes=float(duration_minutes),
            )
            impact = {
                "projected_consumption_kw": flow_calc["consumption_kw"],
                "projected_generation_kw": flow_calc["total_generation_kw"],
                "energy_deficit_kw": flow_calc["energy_deficit_kw"],
                "resupply_delay_days": 45,
                "critical_shortage_risk": "ELEVATED",
                "ration_adjustment_required": True,
                "fuel_burn_multiplier": sd.get("supply_delay_fuel_mult", 0.7),
                "fuel_reserve_percent": flow_calc["projected_final_fuel_pct"],
                "grid_stability_risk": flow_calc["grid_risk"],
            }
            affected_systems = ["Logistics Inventory", "Food Rations", "Spare Parts"]
            recommendations = [
                "Recommendation: Implement strict ration conservation measures across all station consumables.",
                "Recommendation: Cross-audit spare parts inventory with Maitri/Bharati mutual aid agreement.",
            ]

        else: # NORMAL_OPERATION
            impact = {
                "energy_deficit_kw": 0.0,
                "battery_drop_percent": 0.0,
                "fuel_consumption_change_percent": 0.0,
            }
            affected_systems = ["All Station Subsystems Nominal"]
            recommendations = ["Recommendation: Continue standard autonomous monitoring and scheduled maintenance."]

        # ── Attach ML-adjusted forecast so the what-if response shows how the
        # predictive model expects consumption to change under this scenario.
        # Uses scenario_override so this works even for tests (apply_to_live=false).
        try:
            from app.services.energy_forecast_service import energy_forecast_service
            ml_result = energy_forecast_service.predict(
                db, station.id, station.code,
                scenario_override=scenario_upper,
            )
            fc = ml_result.get("forecast", {})
            impact["ml_forecast_6h_kw"] = fc.get("6h", {}).get("average_consumption_kw", 0.0)
            impact["ml_forecast_12h_kw"] = fc.get("12h", {}).get("average_consumption_kw", 0.0)
            impact["ml_forecast_24h_kw"] = fc.get("24h", {}).get("average_consumption_kw", 0.0)
            impact["ml_current_consumption_kw"] = ml_result.get("current_consumption_kw", 0.0)
            impact["ml_scenario_adjusted"] = ml_result.get("scenario_adjusted", False)
        except Exception as e:
            logger.debug(f"ML forecast in what-if response skipped: {e}")

        return ScenarioResponse(
            station_id=station.id,
            station_code=station.code,
            scenario=scenario_upper,
            impact=impact,
            affected_systems=affected_systems,
            recommendations=recommendations,
            applied_to_simulation=False,
            active_until=active_until,
            custom_conditions=custom_conditions,
        )

    def apply_scenario(
        self,
        db: Session,
        scenario_req: ScenarioRequest,
    ) -> ScenarioResponse:
        """Evaluates and optionally applies a What-If scenario or custom conditions to the live Digital Twin."""
        station = station_service.get_station_by_id_or_code(db, scenario_req.station_id)
        station_code = station.code.upper()

        conds_dict = (
            scenario_req.custom_conditions.model_dump(exclude_none=True)
            if scenario_req.custom_conditions
            else None
        )

        response = self.evaluate_what_if_scenario(
            db=db,
            station=station,
            scenario=scenario_req.scenario,
            equipment_id=scenario_req.equipment_id,
            duration_minutes=scenario_req.duration_minutes,
            custom_conditions=conds_dict,
        )

        if scenario_req.apply_to_live:
            self.active_scenarios[station_code] = scenario_req.scenario.upper()
            self.active_conditions[station_code] = conds_dict
            self.scenario_expiries[station_code] = response.active_until
            self.target_equipment_ids[station_code] = scenario_req.equipment_id
            response.applied_to_simulation = True
            logger.info(
                f"Applied scenario '{scenario_req.scenario}' to Station {station_code} until {response.active_until}"
            )
            # Clear the prediction cache so the next dashboard/prediction
            # fetch immediately reflects the new scenario.
            try:
                from app.services.energy_forecast_service import energy_forecast_service
                energy_forecast_service.clear_prediction_cache(station.id)
            except Exception:
                pass

        return response

    async def tick(self, db: Session) -> List[Dict]:
        """Executes a single simulation cycle across all stations in the database."""
        if not self.is_running:
            return []

        now = datetime.now(timezone.utc)
        stations = db.query(Station).all()
        results = []

        for st in stations:
            code = st.code.upper()
            # Check for scenario expiration
            if code in self.scenario_expiries and self.scenario_expiries[code]:
                expiry = self.scenario_expiries[code]
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                if now >= expiry:
                    logger.info(f"Scenario '{self.active_scenarios.get(code)}' expired for {code}. Reverting to NORMAL_OPERATION.")
                    self.active_scenarios[code] = "NORMAL_OPERATION"
                    self.active_conditions[code] = None
                    self.scenario_expiries[code] = None
                    self.target_equipment_ids[code] = None
                    # Clear prediction cache so forecasts revert immediately.
                    try:
                        from app.services.energy_forecast_service import energy_forecast_service
                        energy_forecast_service.clear_prediction_cache(st.id)
                    except Exception:
                        pass

            scenario = self.active_scenarios.get(code, "NORMAL_OPERATION")
            target_eq = self.target_equipment_ids.get(code, None)
            active_conds = self.active_conditions.get(code, None)

            cycle_res = await telemetry_engine.execute_simulation_cycle(
                db=db,
                station=st,
                active_scenario=scenario,
                target_equipment_id=target_eq,
                custom_conditions=active_conds,
                dt_seconds=float(self.interval_seconds),
                broadcast_callback=self.broadcast_callback,
            )
            results.append(cycle_res)

        self.last_tick_at = now
        self.total_cycles_executed += 1
        return results


simulation_service = SimulationService()
