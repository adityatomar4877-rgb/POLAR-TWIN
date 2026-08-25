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

logger = logging.getLogger(__name__)


class SimulationService:
    def __init__(self):
        self.is_running: bool = settings.SIMULATION_ENABLED
        self.interval_seconds: int = settings.SIMULATION_INTERVAL_SECONDS
        self.active_scenarios: Dict[str, str] = {} # station_code -> scenario
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

        now = datetime.now(timezone.utc)
        stations = db.query(Station).all()
        for st in stations:
            code = st.code.upper()
            self.active_scenarios[code] = "NORMAL_OPERATION"
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

        db.commit()
        logger.info("Simulation state reset to deterministic NORMAL_OPERATION for all stations.")
        return {"status": "SUCCESS", "message": "All station simulations reset to NORMAL_OPERATION."}

    def get_status(self) -> SimulationStatusOut:
        return SimulationStatusOut(
            is_running=self.is_running,
            interval_seconds=self.interval_seconds,
            last_tick_at=self.last_tick_at,
            active_scenarios=self.active_scenarios,
            active_scenario_expiry=self.scenario_expiries,
            total_cycles_executed=self.total_cycles_executed,
        )

    def evaluate_what_if_scenario(
        self,
        db: Session,
        station: Station,
        scenario: str,
        equipment_id: Optional[int] = None,
        duration_minutes: int = 60,
    ) -> ScenarioResponse:
        """
        Calculates projected impact of a What-If scenario on energy deficit,
        battery level drop, fuel consumption, affected systems, and operational recommendations.
        """
        scenario_upper = scenario.upper()
        now = datetime.now(timezone.utc)
        active_until = now + timedelta(minutes=duration_minutes)

        target_eq_name = None
        if equipment_id:
            eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
            if eq:
                target_eq_name = eq.name

        impact: Dict[str, Union[float, int, str]] = {}
        affected_systems: List[str] = []
        recommendations: List[str] = []

        if scenario_upper == "GENERATOR_FAILURE":
            impact = {
                "energy_deficit_kw": 120.0,
                "battery_drop_percent": 18.5,
                "fuel_consumption_change_percent": -100.0,
                "grid_stability_risk": "HIGH",
            }
            affected_systems = ["Microgrid Power Generation", "Battery Storage Bank", "Auxiliary Life Support"]
            recommendations = [
                "Recommendation: Operator should dispatch and start backup Generator 2 to restore microgrid generation capacity.",
                "Recommendation: Shed non-essential laboratory and auxiliary electrical loads to reduce battery discharge rate.",
                "Recommendation: Verify battery state-of-charge to ensure black-start reserve threshold (>10%) is maintained.",
            ]

        elif scenario_upper == "EXTREME_COLD":
            impact = {
                "temperature_drop_celsius": -22.0,
                "heating_load_increase_kw": 85.0,
                "fuel_burn_rate_increase_percent": 45.0,
                "battery_efficiency_loss_percent": 12.0,
            }
            affected_systems = ["HVAC Heating & Ventilation", "Diesel Fuel Reserves", "Thermal Insulation Envelopes"]
            recommendations = [
                "Recommendation: Activate secondary auxiliary heating loop in living quarters.",
                "Recommendation: Ensure fuel pipe heat-tracing cables are energized to prevent paraffin gelling.",
                "Recommendation: Prepare emergency Arctic survival pods and suspend all outdoor traverse missions.",
            ]

        elif scenario_upper == "HIGH_ENERGY_DEMAND":
            impact = {
                "energy_deficit_kw": 65.0,
                "battery_drop_percent": 10.0,
                "fuel_consumption_change_percent": 28.0,
            }
            affected_systems = ["Power Distribution Grid", "Generator Loading", "Fuel Inventory"]
            recommendations = [
                "Recommendation: Synchronize Generator 1 and Generator 2 for parallel bus operation.",
                "Recommendation: Stagger high-power deep ice core drilling equipment operations.",
            ]

        elif scenario_upper == "FUEL_SHORTAGE":
            impact = {
                "fuel_level_percent": 12.0,
                "days_until_blackout": 8.5,
                "safe_margin_breach": True,
            }
            affected_systems = ["Fuel Logistics", "Thermal Life Support", "Diesel Power Generation"]
            recommendations = [
                "Recommendation: Initiate Tier-1 Emergency Fuel Conservation Protocol immediately.",
                "Recommendation: Lower ambient room temperatures in unoccupied station zones by 4°C.",
                "Recommendation: Request priority aerial resupply delivery from Cape Town / Maitri logistics corridor.",
            ]

        elif scenario_upper == "EQUIPMENT_DEGRADATION":
            impact = {
                "efficiency_drop_percent": 32.0,
                "operating_temperature_increase_celsius": 18.5,
                "failure_risk_index": 0.85,
            }
            affected_systems = ["HVAC System", "Primary Generator", "Thermal Management"]
            recommendations = [
                "Recommendation: Schedule immediate mechanical maintenance window during favorable weather.",
                "Recommendation: Inspect filter elements, lube oil pressure, and cooling water heat exchangers.",
            ]

        elif scenario_upper == "SUPPLY_DELAY":
            impact = {
                "resupply_delay_days": 45,
                "critical_shortage_risk": "ELEVATED",
                "ration_adjustment_required": True,
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

        return ScenarioResponse(
            station_id=station.id,
            station_code=station.code,
            scenario=scenario_upper,
            impact=impact,
            affected_systems=affected_systems,
            recommendations=recommendations,
            applied_to_simulation=False,
            active_until=active_until,
        )

    def apply_scenario(
        self,
        db: Session,
        scenario_req: ScenarioRequest,
    ) -> ScenarioResponse:
        """Evaluates and optionally applies a What-If scenario to the live Digital Twin."""
        station = station_service.get_station_by_id_or_code(db, scenario_req.station_id)
        station_code = station.code.upper()

        response = self.evaluate_what_if_scenario(
            db=db,
            station=station,
            scenario=scenario_req.scenario,
            equipment_id=scenario_req.equipment_id,
            duration_minutes=scenario_req.duration_minutes,
        )

        if scenario_req.apply_to_live:
            self.active_scenarios[station_code] = scenario_req.scenario.upper()
            self.scenario_expiries[station_code] = response.active_until
            self.target_equipment_ids[station_code] = scenario_req.equipment_id
            response.applied_to_simulation = True
            logger.info(
                f"Applied scenario '{scenario_req.scenario}' to Station {station_code} until {response.active_until}"
            )

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
                    self.scenario_expiries[code] = None
                    self.target_equipment_ids[code] = None

            scenario = self.active_scenarios.get(code, "NORMAL_OPERATION")
            target_eq = self.target_equipment_ids.get(code, None)

            cycle_res = await telemetry_engine.execute_simulation_cycle(
                db=db,
                station=st,
                active_scenario=scenario,
                target_equipment_id=target_eq,
                dt_seconds=float(self.interval_seconds),
                broadcast_callback=self.broadcast_callback,
            )
            results.append(cycle_res)

        self.last_tick_at = now
        self.total_cycles_executed += 1
        return results


simulation_service = SimulationService()
