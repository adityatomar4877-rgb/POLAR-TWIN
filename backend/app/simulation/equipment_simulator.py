import random
import logging
from typing import Dict, List, Optional
from app.models.equipment import Equipment
from app.utils.calculations import calculate_equipment_health

logger = logging.getLogger(__name__)


class EquipmentSimulator:
    """Simulates realistic thermal stress, runtime wear, efficiency degradation, and failure modes for station equipment."""

    @staticmethod
    def update_equipment_state(
        equipment: Equipment,
        active_scenario: str = "NORMAL_OPERATION",
        target_equipment_id: Optional[int] = None,
        custom_conditions: Optional[Dict] = None,
        dt_seconds: float = 10.0,
        scenario_dynamics: Optional[Dict] = None,
    ) -> None:
        eq_type = equipment.equipment_type.upper()
        hours_increment = dt_seconds / 3600.0
        conds = custom_conditions or {}
        sd = scenario_dynamics or {}

        # Increment runtime
        if equipment.status not in ["OFFLINE", "MAINTENANCE"]:
            equipment.runtime_hours += hours_increment

        is_failed = False

        # Custom conditions overrides
        target_id = conds.get("target_equipment_id") or target_equipment_id
        is_target = (target_id is not None and equipment.id == target_id)

        if is_target:
            if conds.get("equipment_state"):
                st = str(conds["equipment_state"]).upper()
                equipment.status = st
                if st in ["OFFLINE", "FAILED"]:
                    equipment.efficiency = 0.0
                    equipment.temperature = 18.0
                    is_failed = True
            if conds.get("equipment_efficiency") is not None:
                equipment.efficiency = float(conds["equipment_efficiency"])
            if conds.get("equipment_temp_offset") is not None:
                equipment.temperature += float(conds["equipment_temp_offset"])

        # Check generator states from custom conditions
        # NOTE: the ``is False`` branches only force OFFLINE when the generator
        # isn't already ONLINE — this prevents a scenario condition from
        # clobbering a START_GENERATOR command on the next tick. The
        # SimulationService.update_generator_state bridge updates the
        # condition itself, but this guard is a second line of defense.
        if conds.get("generator_1_online") is False and "Generator 1" in equipment.name and equipment.status not in ["ONLINE", "RUNNING"]:
            equipment.status = "OFFLINE"
            equipment.efficiency = 0.0
            is_failed = True
        elif conds.get("generator_1_online") is True and "Generator 1" in equipment.name and equipment.status == "OFFLINE":
            equipment.status = "ONLINE"
            equipment.efficiency = 94.0

        if conds.get("generator_2_online") is True and "Generator 2" in equipment.name and equipment.status == "OFFLINE":
            equipment.status = "ONLINE"
            equipment.efficiency = 94.0
        elif conds.get("generator_2_online") is False and "Generator 2" in equipment.name and equipment.status not in ["ONLINE", "RUNNING"]:
            equipment.status = "OFFLINE"
            equipment.efficiency = 0.0

        # Scenario impacts
        if active_scenario == "GENERATOR_FAILURE":
            if (target_equipment_id and equipment.id == target_equipment_id) or (
                not target_equipment_id and "Generator 1" in equipment.name
            ):
                equipment.status = "OFFLINE"
                equipment.efficiency = 0.0
                equipment.temperature = 18.0
                is_failed = True
            # Backup generator carries full load → stress from actual load shift
            if "Generator 2" in equipment.name:
                equipment.temperature = min(95.0, equipment.temperature + sd.get("gen2_temp_rise", 2.0))
                equipment.efficiency = max(80.0, equipment.efficiency - sd.get("gen2_eff_drop", 1.0))

        elif active_scenario == "EQUIPMENT_DEGRADATION":
            if "HVAC" in equipment.name or "Generator" in equipment.name:
                # Degradation proportional to current efficiency gap
                eff_gap = max(0, 94.0 - equipment.efficiency)
                equipment.efficiency = max(55.0, equipment.efficiency - 0.1 - eff_gap * 0.05)
                equipment.temperature += 0.3 + eff_gap * 0.02
                equipment.status = "WARNING"

        elif active_scenario == "EXTREME_COLD":
            if "HVAC" in equipment.name:
                # HVAC stress from actual thermal load delta
                cold_delta = sd.get("extreme_cold_consumption_delta_kw", 20.0)
                stress = min(1.0, cold_delta / 50.0)
                equipment.temperature = min(88.0, equipment.temperature + 0.2 + stress * 0.5)
                equipment.efficiency = max(75.0, equipment.efficiency - 0.05 - stress * 0.2)

        elif active_scenario == "HIGH_ENERGY_DEMAND":
            # Generators under higher load → stress from actual extra demand
            if eq_type == "GENERATOR" and equipment.status not in ["OFFLINE", "MAINTENANCE"]:
                extra_load = sd.get("high_demand_extra_load_kw", 55.0)
                load_stress = min(1.0, extra_load / 100.0)
                equipment.temperature = min(95.0, equipment.temperature + load_stress * 5.0)
                equipment.efficiency = max(85.0, equipment.efficiency - load_stress * 2.0)
            # Battery bank cycles harder → temp rise from extra demand
            if eq_type == "BATTERY_BANK":
                extra_load = sd.get("high_demand_extra_load_kw", 55.0)
                equipment.temperature = round(min(38.0, equipment.temperature + min(2.0, extra_load / 30.0)), 1)

        elif active_scenario == "FUEL_SHORTAGE":
            # Low fuel → generators run lean → wear from actual fuel level
            if eq_type == "GENERATOR" and equipment.status not in ["OFFLINE", "MAINTENANCE"]:
                wear = sd.get("fuel_shortage_gen_wear", 0.2)
                equipment.efficiency = max(78.0, equipment.efficiency - wear)
                equipment.temperature = min(90.0, equipment.temperature + wear * 2.0)
                equipment.status = "WARNING"

        elif active_scenario == "SUPPLY_DELAY":
            # No spare parts → maintenance overdue → health degrades from actual days overdue
            if equipment.last_maintenance:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                if equipment.last_maintenance.tzinfo is None:
                    last_maint = equipment.last_maintenance.replace(tzinfo=timezone.utc)
                else:
                    last_maint = equipment.last_maintenance
                days_overdue = (now - last_maint).days
                # Degradation proportional to days overdue (not a fixed delta)
                if days_overdue > 30:
                    degrade_rate = min(0.1, (days_overdue - 30) / 300.0)
                    equipment.efficiency = max(78.0, equipment.efficiency - degrade_rate)
                    if equipment.status == "NORMAL":
                        equipment.status = "WARNING"

        # Baseline thermal and efficiency physics if running normally
        # Using Gaussian noise (real thermal sensors have normally-distributed error)
        if not is_failed and active_scenario in ["NORMAL_OPERATION", "CUSTOM"] and not is_target:
            if eq_type == "GENERATOR":
                equipment.temperature = round(72.0 + random.gauss(0.0, 0.8), 1)
                equipment.efficiency = round(max(88.0, min(97.0, 94.0 + random.gauss(0.0, 0.3))), 1)
            elif eq_type == "BATTERY_BANK":
                equipment.temperature = round(21.0 + random.gauss(0.0, 0.4), 1)
                equipment.efficiency = round(max(92.0, min(99.0, 96.0 + random.gauss(0.0, 0.15))), 1)
            elif eq_type == "HVAC":
                equipment.temperature = round(42.0 + random.gauss(0.0, 0.5), 1)
                equipment.efficiency = round(max(85.0, min(96.0, 92.0 + random.gauss(0.0, 0.25))), 1)
            elif eq_type == "SOLAR_ARRAY":
                equipment.temperature = round(-5.0 + random.gauss(0.0, 1.0), 1)
                equipment.efficiency = round(max(80.0, min(95.0, 90.0 + random.gauss(0.0, 0.3))), 1)
            else:
                equipment.temperature = round(25.0 + random.gauss(0.0, 0.3), 1)
                equipment.efficiency = round(max(90.0, min(99.0, 95.0 + random.gauss(0.0, 0.15))), 1)

        # Evaluate diagnostic health score
        nominal_temp = 70.0 if eq_type == "GENERATOR" else (40.0 if eq_type == "HVAC" else 25.0)
        health_calc = calculate_equipment_health(
            name=equipment.name,
            equipment_type=equipment.equipment_type,
            temperature=equipment.temperature,
            runtime_hours=equipment.runtime_hours,
            efficiency=equipment.efficiency,
            last_maintenance=equipment.last_maintenance,
            nominal_temp=nominal_temp,
            is_faulty=is_failed,
        )

        equipment.health_score = health_calc["health_score"]
        if is_failed:
            equipment.status = "OFFLINE"
        elif equipment.status in ["ONLINE", "RUNNING", "STANDBY", "MAINTENANCE"]:
            if health_calc["status"] in ["WARNING", "CRITICAL"]:
                equipment.status = health_calc["status"]
        else:
            equipment.status = health_calc["status"]
