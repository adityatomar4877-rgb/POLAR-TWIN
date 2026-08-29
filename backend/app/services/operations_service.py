import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.audit import LoadGroup, OperationalRecommendation
from app.models.equipment import Equipment
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.models.logistics import LogisticsItem
from app.models.station import Station
from app.schemas.operations import OperationsStatusOut, LoadGroupOut, OperationalRecommendationOut
from app.services.safety_service import safety_service
from app.services.audit_service import audit_service
from app.core.config import settings
from app.core.security import APIError

logger = logging.getLogger(__name__)


class OperationsService:
    @staticmethod
    def get_station_loads(db: Session, station_id: int) -> List[LoadGroup]:
        return db.query(LoadGroup).filter(LoadGroup.station_id == station_id).order_by(LoadGroup.priority.asc()).all()

    @staticmethod
    def shed_load_group(
        db: Session,
        station_id: int,
        group_identifier: str = "NON_CRITICAL",
        reason: Optional[str] = None,
        actor: str = settings.DEFAULT_OPERATOR_ID,
    ) -> Dict[str, Any]:
        """Sheds non-critical or specified load groups to immediately reduce station power deficit."""
        loads = db.query(LoadGroup).filter(LoadGroup.station_id == station_id).all()
        
        target_loads: List[LoadGroup] = []
        if str(group_identifier).upper() in ["NON_CRITICAL", "ALL"]:
            target_loads = [l for l in loads if l.category == "NON_CRITICAL" and l.enabled]
        else:
            target_loads = [
                l for l in loads 
                if (str(l.id) == str(group_identifier) or l.name.lower() == str(group_identifier).lower() or l.category.upper() == str(group_identifier).upper())
            ]

        if not target_loads:
            raise APIError(
                code="NO_SHEDDABLE_LOADS",
                message=f"No active shedable loads found matching '{group_identifier}'.",
                status_code=400,
            )

        total_shed_kw = 0.0
        shed_names = []
        for l in target_loads:
            safety_service.validate_load_shed_safety(l)
            l.enabled = False
            total_shed_kw += l.current_power_kw
            shed_names.append(l.name)

        # Update latest energy telemetry
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        if latest_energy:
            latest_energy.consumption_kw = max(20.0, round(latest_energy.consumption_kw - total_shed_kw, 2))
            latest_energy.energy_balance = round(latest_energy.generation_kw - latest_energy.consumption_kw, 2)
            if latest_energy.energy_balance >= 0:
                latest_energy.battery_power_kw = min(30.0, latest_energy.energy_balance)
            else:
                latest_energy.battery_power_kw = latest_energy.energy_balance

        audit_service.log_action(
            db=db,
            station_id=station_id,
            actor=actor,
            action="LOAD_SHED",
            target=f"Shed Loads: {', '.join(shed_names)} (-{total_shed_kw:.1f} kW)",
            result="SUCCESS",
            new_state={"shed_load_kw": total_shed_kw, "loads": shed_names, "reason": reason},
        )
        db.commit()

        return {
            "success": True,
            "shed_load_kw": total_shed_kw,
            "shed_groups": shed_names,
            "remaining_consumption_kw": latest_energy.consumption_kw if latest_energy else 0.0,
            "new_energy_balance_kw": latest_energy.energy_balance if latest_energy else 0.0,
            "message": f"Successfully shed {total_shed_kw:.1f} kW of non-critical loads ({', '.join(shed_names)}).",
        }

    @staticmethod
    def restore_load_group(
        db: Session,
        station_id: int,
        group_identifier: str = "ALL",
        reason: Optional[str] = None,
        actor: str = settings.DEFAULT_OPERATOR_ID,
    ) -> Dict[str, Any]:
        """Restores previously shed loads with generation headroom validation."""
        loads = db.query(LoadGroup).filter(LoadGroup.station_id == station_id).all()
        
        target_loads: List[LoadGroup] = []
        if str(group_identifier).upper() in ["ALL", "NON_CRITICAL"]:
            target_loads = [l for l in loads if not l.enabled]
        else:
            target_loads = [
                l for l in loads 
                if (str(l.id) == str(group_identifier) or l.name.lower() == str(group_identifier).lower() or l.category.upper() == str(group_identifier).upper()) and not l.enabled
            ]

        if not target_loads:
            return {
                "success": True,
                "restored_load_kw": 0.0,
                "restored_groups": [],
                "new_consumption_kw": 0.0,
                "new_energy_balance_kw": 0.0,
                "message": "All matching loads are already active and online.",
            }

        total_restore_kw = sum(l.current_power_kw for l in target_loads)
        safety_service.validate_load_restoration_safety(db, station_id, total_restore_kw)

        restored_names = []
        for l in target_loads:
            l.enabled = True
            restored_names.append(l.name)

        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        if latest_energy:
            latest_energy.consumption_kw = round(latest_energy.consumption_kw + total_restore_kw, 2)
            latest_energy.energy_balance = round(latest_energy.generation_kw - latest_energy.consumption_kw, 2)
            if latest_energy.energy_balance >= 0:
                latest_energy.battery_power_kw = min(30.0, latest_energy.energy_balance)
            else:
                latest_energy.battery_power_kw = latest_energy.energy_balance

        audit_service.log_action(
            db=db,
            station_id=station_id,
            actor=actor,
            action="LOAD_RESTORE",
            target=f"Restored Loads: {', '.join(restored_names)} (+{total_restore_kw:.1f} kW)",
            result="SUCCESS",
            new_state={"restored_load_kw": total_restore_kw, "loads": restored_names, "reason": reason},
        )
        db.commit()

        return {
            "success": True,
            "restored_load_kw": total_restore_kw,
            "restored_groups": restored_names,
            "new_consumption_kw": latest_energy.consumption_kw if latest_energy else 0.0,
            "new_energy_balance_kw": latest_energy.energy_balance if latest_energy else 0.0,
            "message": f"Successfully restored {total_restore_kw:.1f} kW of loads ({', '.join(restored_names)}).",
        }

    @staticmethod
    def set_emergency_mode(
        db: Session,
        station_id: int,
        enabled: bool,
        reason: Optional[str] = None,
        actor: str = settings.DEFAULT_OPERATOR_ID,
    ) -> Dict[str, Any]:
        station = db.query(Station).filter(Station.id == station_id).first()
        if not station:
            raise APIError(
                code="STATION_NOT_FOUND",
                message=f"Station #{station_id} not found.",
                status_code=404,
            )
        prev_mode = station.status
        new_mode = "EMERGENCY" if enabled else "OPERATIONAL"
        station.status = new_mode

        audit_service.log_action(
            db=db,
            station_id=station_id,
            actor=actor,
            action="SET_EMERGENCY_MODE",
            target=f"Station Operational Mode: {new_mode}",
            result="SUCCESS",
            previous_state={"status": prev_mode},
            new_state={"status": new_mode, "reason": reason},
        )
        db.commit()

        return {
            "success": True,
            "station_id": station_id,
            "operational_mode": new_mode,
            "message": f"Station operational mode transitioned to {new_mode}.",
        }

    @staticmethod
    def generate_recommendations(db: Session, station_id: int) -> List[OperationalRecommendation]:
        """
        Analyzes live Digital Twin microgrid, equipment, environment, and logistics states
        to generate prioritized, actionable operational recommendations.
        """
        now = datetime.now(timezone.utc)
        recommendations: List[OperationalRecommendation] = []

        # 1. Check Generator & Power Deficit
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        equipment_list = db.query(Equipment).filter(Equipment.station_id == station_id).all()
        generators = [e for e in equipment_list if e.equipment_type == "GENERATOR"]
        standby_gens = [g for g in generators if g.status in ["STANDBY", "NORMAL"] and g.name != "Generator 1"]
        failed_gens = [g for g in generators if g.status == "OFFLINE"]

        if latest_energy and latest_energy.energy_balance < -15.0:
            if standby_gens:
                target_g = standby_gens[0]
                rec = OperationalRecommendation(
                    station_id=station_id,
                    severity="CRITICAL",
                    category="ENERGY",
                    title=f"Microgrid Power Deficit — Start Backup {target_g.name}",
                    explanation=f"Active generation shortfall of {abs(latest_energy.energy_balance):.1f} kW is discharging station battery storage at -{abs(latest_energy.battery_power_kw):.1f} kW.",
                    suggested_action=f"Dispatch and start {target_g.name} immediately to restore microgrid power balance.",
                    target_command_type="START_GENERATOR",
                    target_equipment_id=target_g.id,
                    affected_systems_json=json.dumps(["Power Generation", "Battery Storage Bank"]),
                    created_at=now,
                    expires_at=now + timedelta(hours=2),
                    status="ACTIVE",
                )
                recommendations.append(rec)

            # Check if active non-critical loads can be shed
            loads = db.query(LoadGroup).filter(LoadGroup.station_id == station_id, LoadGroup.category == "NON_CRITICAL", LoadGroup.enabled == True).all()
            if loads:
                total_kw = sum(l.current_power_kw for l in loads)
                rec = OperationalRecommendation(
                    station_id=station_id,
                    severity="WARNING",
                    category="ENERGY",
                    title=f"Energy Deficit Mitigation — Shed Non-Critical Auxiliary Loads",
                    explanation=f"Shedding {len(loads)} active non-critical load groups will reduce station demand by {total_kw:.1f} kW.",
                    suggested_action="Execute automated load shedding on non-essential scientific and auxiliary circuits.",
                    target_command_type="LOAD_SHED",
                    target_parameters_json=json.dumps({"load_group": "NON_CRITICAL"}),
                    affected_systems_json=json.dumps(["Auxiliary Power", "Laboratory Loads"]),
                    created_at=now,
                    expires_at=now + timedelta(hours=2),
                    status="ACTIVE",
                )
                recommendations.append(rec)

        # 2. Check Equipment Degradation
        for eq in equipment_list:
            if eq.health_score < 60.0 and eq.status != "OFFLINE":
                rec = OperationalRecommendation(
                    station_id=station_id,
                    severity="WARNING" if eq.health_score >= 30.0 else "CRITICAL",
                    category="EQUIPMENT",
                    title=f"Equipment Degradation Warning — {eq.name}",
                    explanation=f"{eq.name} health score is degraded to {eq.health_score:.1f}/100 (Operating Temp: {eq.temperature:.1f}°C, Efficiency: {eq.efficiency:.1f}%).",
                    suggested_action=f"Create a high-priority maintenance inspection task for {eq.name}.",
                    target_command_type="CREATE_MAINTENANCE",
                    target_equipment_id=eq.id,
                    affected_systems_json=json.dumps([eq.equipment_type]),
                    created_at=now,
                    expires_at=now + timedelta(hours=12),
                    status="ACTIVE",
                )
                recommendations.append(rec)

        # 3. Check Fuel Logistics
        fuel_item = db.query(LogisticsItem).filter(LogisticsItem.station_id == station_id, LogisticsItem.category == "FUEL").first()
        if fuel_item and fuel_item.days_remaining < 30.0:
            rec = OperationalRecommendation(
                station_id=station_id,
                severity="CRITICAL" if fuel_item.days_remaining < 15.0 else "WARNING",
                category="LOGISTICS",
                title="Fuel Reserve Approaching Critical Threshold — Request Resupply",
                explanation=f"Arctic diesel fuel reserve has only {fuel_item.days_remaining:.1f} days remaining ({fuel_item.quantity:.0f} liters).",
                suggested_action="Issue emergency seasonal fuel resupply request.",
                target_command_type="CREATE_RESUPPLY",
                target_parameters_json=json.dumps({"item": "FUEL", "quantity": 15000.0, "unit": "liters"}),
                affected_systems_json=json.dumps(["Fuel Logistics", "Power Generation"]),
                created_at=now,
                expires_at=now + timedelta(days=2),
                status="ACTIVE",
            )
            recommendations.append(rec)

        return recommendations

    @staticmethod
    def get_operations_status(db: Session, station_id: int) -> OperationsStatusOut:
        station = db.query(Station).filter(Station.id == station_id).first()
        loads = db.query(LoadGroup).filter(LoadGroup.station_id == station_id).all()
        active_loads = [l for l in loads if l.enabled]
        shed_loads = [l for l in loads if not l.enabled]
        
        recs = OperationsService.generate_recommendations(db, station_id)
        from app.models.command import Command
        from app.models.maintenance import MaintenanceTask, ResupplyRequest

        active_commands = db.query(Command).filter(Command.station_id == station_id, Command.status.in_(["REQUESTED", "EXECUTING"])).count()
        pending_maint = db.query(MaintenanceTask).filter(MaintenanceTask.station_id == station_id, MaintenanceTask.status.in_(["OPEN", "SCHEDULED", "IN_PROGRESS"])).count()
        pending_resupply = db.query(ResupplyRequest).filter(ResupplyRequest.station_id == station_id, ResupplyRequest.status.in_(["REQUESTED", "APPROVED", "IN_TRANSIT"])).count()

        return OperationsStatusOut(
            station_id=station.id,
            station_code=station.code,
            operational_mode=station.status,
            active_commands_count=active_commands,
            active_recommendations_count=len(recs),
            pending_maintenance_count=pending_maint,
            pending_resupply_count=pending_resupply,
            load_shed_active=len(shed_loads) > 0,
            total_active_load_kw=round(sum(l.current_power_kw for l in active_loads), 1),
            total_shed_load_kw=round(sum(l.current_power_kw for l in shed_loads), 1),
            active_recommendations=[
                OperationalRecommendationOut(
                    id=i + 1,
                    station_id=r.station_id,
                    severity=r.severity,
                    category=r.category,
                    title=r.title,
                    explanation=r.explanation,
                    suggested_action=r.suggested_action,
                    target_command_type=r.target_command_type,
                    target_equipment_id=r.target_equipment_id,
                    status=r.status,
                    created_at=r.created_at,
                    expires_at=r.expires_at,
                ) for i, r in enumerate(recs)
            ],
            loads=[LoadGroupOut.model_validate(l) for l in loads],
        )


operations_service = OperationsService()
