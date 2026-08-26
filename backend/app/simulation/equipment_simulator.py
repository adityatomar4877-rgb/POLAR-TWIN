import random
from typing import Dict, List, Optional
from app.models.equipment import Equipment
from app.utils.calculations import calculate_equipment_health


class EquipmentSimulator:
    """Simulates realistic thermal stress, runtime wear, efficiency degradation, and failure modes for station equipment."""

    @staticmethod
    def update_equipment_state(
        equipment: Equipment,
        active_scenario: str = "NORMAL_OPERATION",
        target_equipment_id: Optional[int] = None,
        custom_conditions: Optional[Dict] = None,
        dt_seconds: float = 10.0,
    ) -> None:
        eq_type = equipment.equipment_type.upper()
        hours_increment = dt_seconds / 3600.0
        conds = custom_conditions or {}

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
        if conds.get("generator_1_online") is False and "Generator 1" in equipment.name:
            equipment.status = "OFFLINE"
            equipment.efficiency = 0.0
            is_failed = True
        elif conds.get("generator_1_online") is True and "Generator 1" in equipment.name and equipment.status == "OFFLINE":
            equipment.status = "ONLINE"
            equipment.efficiency = 94.0

        if conds.get("generator_2_online") is True and "Generator 2" in equipment.name and equipment.status == "OFFLINE":
            equipment.status = "ONLINE"
            equipment.efficiency = 94.0
        elif conds.get("generator_2_online") is False and "Generator 2" in equipment.name:
            equipment.status = "OFFLINE"
            equipment.efficiency = 0.0

        # Scenario impacts
        if active_scenario == "GENERATOR_FAILURE":
            if (target_equipment_id and equipment.id == target_equipment_id) or (
                not target_equipment_id and "Generator 1" in equipment.name
            ):
                equipment.status = "OFFLINE"
                equipment.efficiency = 0.0
                equipment.temperature = 18.0 # Cold offline temperature
                is_failed = True

        elif active_scenario == "EQUIPMENT_DEGRADATION":
            if "HVAC" in equipment.name or "Generator" in equipment.name:
                equipment.efficiency = max(55.0, equipment.efficiency - 0.2)
                equipment.temperature += 0.5
                equipment.status = "WARNING"

        elif active_scenario == "EXTREME_COLD":
            if "HVAC" in equipment.name:
                equipment.temperature = min(88.0, equipment.temperature + 0.3)
                equipment.efficiency = max(78.0, equipment.efficiency - 0.1)

        # Baseline thermal and efficiency physics if running normally
        if not is_failed and active_scenario in ["NORMAL_OPERATION", "CUSTOM"] and not is_target:
            if eq_type == "GENERATOR":
                equipment.temperature = round(72.0 + random.uniform(-1.5, 1.5), 1)
                equipment.efficiency = round(max(88.0, min(97.0, 94.0 + random.uniform(-0.5, 0.5))), 1)
            elif eq_type == "BATTERY_BANK":
                equipment.temperature = round(21.0 + random.uniform(-0.8, 0.8), 1)
                equipment.efficiency = round(max(92.0, min(99.0, 96.0 + random.uniform(-0.2, 0.2))), 1)
            elif eq_type == "HVAC":
                equipment.temperature = round(42.0 + random.uniform(-1.0, 1.0), 1)
                equipment.efficiency = round(max(85.0, min(96.0, 92.0 + random.uniform(-0.4, 0.4))), 1)
            elif eq_type == "SOLAR_ARRAY":
                equipment.temperature = round(-5.0 + random.uniform(-2.0, 2.0), 1)
                equipment.efficiency = round(max(80.0, min(95.0, 90.0 + random.uniform(-0.5, 0.5))), 1)
            else:
                equipment.temperature = round(25.0 + random.uniform(-0.5, 0.5), 1)
                equipment.efficiency = round(max(90.0, min(99.0, 95.0 + random.uniform(-0.2, 0.2))), 1)

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
