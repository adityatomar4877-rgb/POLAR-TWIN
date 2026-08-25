import logging
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.equipment import Equipment
from app.models.energy import EnergyTelemetry
from app.models.audit import LoadGroup
from app.core.security import APIError

logger = logging.getLogger(__name__)

ROLE_PERMISSIONS = {
    "VIEWER": set(),
    "OPERATOR": {
        "START_GENERATOR",
        "LOAD_SHED",
        "LOAD_RESTORE",
        "RESTART_EQUIPMENT",
        "CREATE_MAINTENANCE",
        "CREATE_RESUPPLY",
    },
    "SUPERVISOR": {
        "START_GENERATOR",
        "STOP_GENERATOR",
        "LOAD_SHED",
        "LOAD_RESTORE",
        "ENTER_EMERGENCY_MODE",
        "EXIT_EMERGENCY_MODE",
        "RESTART_EQUIPMENT",
        "SHUTDOWN_EQUIPMENT",
        "ISOLATE_EQUIPMENT",
        "CREATE_MAINTENANCE",
        "CREATE_RESUPPLY",
    },
    "ADMIN": {
        "START_GENERATOR",
        "STOP_GENERATOR",
        "LOAD_SHED",
        "LOAD_RESTORE",
        "ENTER_EMERGENCY_MODE",
        "EXIT_EMERGENCY_MODE",
        "RESTART_EQUIPMENT",
        "SHUTDOWN_EQUIPMENT",
        "ISOLATE_EQUIPMENT",
        "CREATE_MAINTENANCE",
        "CREATE_RESUPPLY",
        "OVERRIDE_INTERLOCK",
    },
}

HIGH_RISK_COMMANDS = {
    "STOP_GENERATOR",
    "ENTER_EMERGENCY_MODE",
    "SHUTDOWN_EQUIPMENT",
    "ISOLATE_EQUIPMENT",
}


class SafetyService:
    @staticmethod
    def validate_role_permission(role: str, command_type: str) -> None:
        role_upper = (role or "OPERATOR").upper()
        allowed = ROLE_PERMISSIONS.get(role_upper, ROLE_PERMISSIONS["OPERATOR"])
        if command_type not in allowed:
            raise APIError(
                code="PERMISSION_DENIED",
                message=f"Operator role '{role_upper}' is not authorized to execute '{command_type}'.",
                status_code=403,
            )

    @staticmethod
    def is_high_risk(command_type: str) -> bool:
        return command_type in HIGH_RISK_COMMANDS

    @staticmethod
    def validate_generator_stop_safety(db: Session, station_id: int, generator: Equipment) -> None:
        """Safety interlock: Cannot stop the sole active generator without backup ready."""
        other_generators = (
            db.query(Equipment)
            .filter(
                Equipment.station_id == station_id,
                Equipment.equipment_type == "GENERATOR",
                Equipment.id != generator.id,
            )
            .all()
        )
        online_others = [g for g in other_generators if g.status in ["ONLINE", "STARTING", "NORMAL"]]

        # Check current solar vs station load
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        solar_gen = latest_energy.solar_generation_kw if latest_energy else 0.0
        consumption = latest_energy.consumption_kw if latest_energy else 100.0

        if not online_others and (consumption - solar_gen) > 20.0:
            raise APIError(
                code="UNSAFE_COMMAND",
                message="Cannot stop the only active generator. Station microgrid would experience severe black-start power collapse.",
                status_code=409,
                details={
                    "recommendation": "Operator should start and synchronize backup Generator 2 before stopping this generator.",
                    "active_online_generators": 1,
                    "deficit_risk_kw": round(consumption - solar_gen, 1),
                },
            )

    @staticmethod
    def validate_generator_start_safety(db: Session, station_id: int, generator: Equipment) -> None:
        """Safety interlock: Starting an OFFLINE (tripped) generator requires maintenance clearing."""
        if generator.status == "OFFLINE" and generator.health_score < 30.0:
            raise APIError(
                code="EQUIPMENT_FAULT_LOCKOUT",
                message=f"Cannot start {generator.name}: asset is in tripped OFFLINE state with critical health fault ({generator.health_score:.1f}/100).",
                status_code=409,
                details={
                    "recommendation": "Complete scheduled inspection/maintenance and clear mechanical trip flag before startup.",
                },
            )

    @staticmethod
    def validate_load_shed_safety(load_group: LoadGroup) -> None:
        """Safety interlock: Critical life support / HVAC loads cannot be shed."""
        if load_group.category == "CRITICAL" or not load_group.shedable:
            raise APIError(
                code="CRITICAL_LOAD_PROTECTED",
                message=f"Load group '{load_group.name}' is designated CRITICAL ({load_group.category}) and cannot be shed.",
                status_code=409,
                details={
                    "recommendation": "Select a NON_CRITICAL or HIGH_PRIORITY auxiliary load group for shedding.",
                },
            )

    @staticmethod
    def validate_load_restoration_safety(db: Session, station_id: int, load_to_restore_kw: float) -> None:
        """Safety interlock: Reject load restoration if generation capacity is insufficient."""
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        if latest_energy:
            projected_con = latest_energy.consumption_kw + load_to_restore_kw
            projected_bal = latest_energy.generation_kw - projected_con
            if projected_bal < -25.0 and latest_energy.battery_percentage < 35.0:
                raise APIError(
                    code="INSUFFICIENT_GENERATION_HEADROOM",
                    message="Load restoration rejected: available microgrid generation capacity cannot sustain restored load.",
                    status_code=409,
                    details={
                        "current_generation_kw": latest_energy.generation_kw,
                        "projected_consumption_kw": round(projected_con, 1),
                        "projected_deficit_kw": round(projected_bal, 1),
                        "recommendation": "Start backup generator or increase solar dispatch before restoring load.",
                    },
                )

    @staticmethod
    def validate_equipment_shutdown_safety(equipment: Equipment, role: str, confirmed: bool) -> None:
        """Safety interlock: Critical infrastructure requires supervisor authorization and explicit confirmation."""
        critical_types = {"WATER_TREATMENT", "HVAC", "COMMUNICATIONS"}
        if equipment.equipment_type in critical_types:
            if role not in ["SUPERVISOR", "ADMIN"]:
                raise APIError(
                    code="SUPERVISOR_AUTHORIZATION_REQUIRED",
                    message=f"Shutting down critical life support asset '{equipment.name}' requires SUPERVISOR or ADMIN role.",
                    status_code=403,
                )
            if not confirmed:
                raise APIError(
                    code="CONFIRMATION_REQUIRED",
                    message=f"Shutting down critical asset '{equipment.name}' requires explicit operator confirmation flag (confirmed=true).",
                    status_code=400,
                )


safety_service = SafetyService()
