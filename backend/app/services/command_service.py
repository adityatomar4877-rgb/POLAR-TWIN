import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.command import Command
from app.models.equipment import Equipment
from app.models.station import Station
from app.models.energy import EnergyTelemetry
from app.models.alert import Alert
from app.schemas.command import (
    CommandPreviewRequest,
    CommandPreviewResponse,
    CommandRequest,
    CommandResponse,
)
from app.services.safety_service import safety_service
from app.services.audit_service import audit_service
from app.services.operations_service import operations_service
from app.services.maintenance_service import maintenance_service
from app.core.security import APIError

logger = logging.getLogger(__name__)


class CommandService:
    def __init__(self):
        self.broadcast_callback: Optional[Callable] = None

    def set_broadcast_callback(self, callback: Callable):
        self.broadcast_callback = callback

    async def _emit_event(self, station_code: str, event_type: str, payload: dict):
        if self.broadcast_callback:
            try:
                msg = {
                    "event": event_type,
                    "station_code": station_code.lower(),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": payload,
                }
                if asyncio.iscoroutinefunction(self.broadcast_callback):
                    await self.broadcast_callback(station_code.lower(), msg)
                else:
                    self.broadcast_callback(station_code.lower(), msg)
            except Exception as e:
                logger.debug(f"WebSocket broadcast error: {e}")

    def preview_command(
        self, db: Session, station_id: int, preview_req: CommandPreviewRequest
    ) -> CommandPreviewResponse:
        """
        Calculates a Digital Twin simulation preview of a command before execution.
        Provides projected generation changes, deficit relief, and safety warnings.
        """
        cmd_type = preview_req.command_type.upper()
        station = db.query(Station).filter(Station.id == station_id).first()
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )

        current_gen = latest_energy.generation_kw if latest_energy else 100.0
        current_con = latest_energy.consumption_kw if latest_energy else 100.0
        current_bal = latest_energy.energy_balance if latest_energy else 0.0

        safe = True
        requires_conf = safety_service.is_high_risk(cmd_type)
        warnings: List[str] = []
        recommendations: List[str] = []
        projected_state: Dict[str, Any] = {}
        impact: Dict[str, Any] = {}

        if cmd_type == "START_GENERATOR":
            target_eq = None
            if preview_req.target_id:
                target_eq = db.query(Equipment).filter(Equipment.id == preview_req.target_id).first()

            gen_boost = 90.0
            proj_gen = current_gen + gen_boost
            proj_bal = round(proj_gen - current_con, 2)
            
            projected_state = {
                "target_equipment": target_eq.name if target_eq else "Generator",
                "target_status": "ONLINE",
                "projected_generation_kw": proj_gen,
                "projected_energy_balance_kw": proj_bal,
                "projected_grid_status": "ONLINE" if proj_bal >= 0 else "DEGRADED",
            }
            impact = {
                "generation_change_kw": gen_boost,
                "energy_balance_change_kw": round(proj_bal - current_bal, 2),
                "battery_discharge_reduction_kw": abs(min(0.0, current_bal)),
                "fuel_consumption_resumption_l_per_h": round(gen_boost * 0.26, 1),
            }
            recommendations.append("Starting generator will eliminate microgrid power deficit and halt battery depletion.")

        elif cmd_type == "STOP_GENERATOR":
            target_eq = None
            if preview_req.target_id:
                target_eq = db.query(Equipment).filter(Equipment.id == preview_req.target_id).first()
                try:
                    safety_service.validate_generator_stop_safety(db, station_id, target_eq)
                except APIError as ae:
                    safe = False
                    warnings.append(ae.message)

            gen_drop = 90.0
            proj_gen = max(0.0, current_gen - gen_drop)
            proj_bal = round(proj_gen - current_con, 2)
            projected_state = {
                "target_equipment": target_eq.name if target_eq else "Generator",
                "target_status": "STANDBY",
                "projected_generation_kw": proj_gen,
                "projected_energy_balance_kw": proj_bal,
            }
            impact = {
                "generation_change_kw": -gen_drop,
                "energy_balance_change_kw": round(proj_bal - current_bal, 2),
            }
            if proj_bal < 0:
                warnings.append(f"Stopping generator will create a {abs(proj_bal):.1f} kW power deficit on station battery.")

        elif cmd_type == "LOAD_SHED":
            from app.models.audit import LoadGroup
            shed_loads = db.query(LoadGroup).filter(LoadGroup.station_id == station_id, LoadGroup.category == "NON_CRITICAL", LoadGroup.enabled == True).all()
            total_shed = sum(l.current_power_kw for l in shed_loads)
            proj_con = max(20.0, current_con - total_shed)
            proj_bal = round(current_gen - proj_con, 2)
            
            projected_state = {
                "shed_groups_count": len(shed_loads),
                "projected_consumption_kw": proj_con,
                "projected_energy_balance_kw": proj_bal,
            }
            impact = {
                "consumption_reduction_kw": total_shed,
                "deficit_reduction_kw": total_shed,
            }
            recommendations.append(f"Shedding non-critical loads will relieve station microgrid by {total_shed:.1f} kW.")

        else:
            projected_state = {"status": "ACKNOWLEDGED"}
            impact = {"status_change": True}

        return CommandPreviewResponse(
            command_type=cmd_type,
            safe=safe,
            requires_confirmation=requires_conf,
            current_state={
                "generation_kw": current_gen,
                "consumption_kw": current_con,
                "energy_balance_kw": current_bal,
                "grid_status": latest_energy.grid_status if latest_energy else "ONLINE",
            },
            projected_state=projected_state,
            impact=impact,
            warnings=warnings,
            recommendations=recommendations,
        )

    async def execute_command(
        self, db: Session, station_id: int, command_req: CommandRequest
    ) -> CommandResponse:
        """
        Executes a remote operator command across the strict Digital Twin validation pipeline:
        REQUEST -> INPUT VALIDATION -> SAFETY INTERLOCKS -> STATE CHANGE -> SYSTEM RECALCULATION -> AUDIT -> BROADCAST
        """
        now = datetime.now(timezone.utc)
        cmd_type = command_req.command_type.upper()
        station = db.query(Station).filter(Station.id == station_id).first()

        # 1. Validate Operator Authorization
        safety_service.validate_role_permission(command_req.role, cmd_type)

        # 2. Create Command Record
        cmd = Command(
            station_id=station_id,
            command_type=cmd_type,
            target_type=command_req.target_type.upper(),
            target_id=command_req.target_id,
            requested_by=command_req.requested_by,
            role=command_req.role.upper(),
            status="VALIDATING",
            parameters_json=json.dumps(command_req.parameters or {}),
            reason=command_req.reason,
            created_at=now,
        )
        db.add(cmd)
        db.flush()

        previous_state: Dict[str, Any] = {}
        new_state: Dict[str, Any] = {}
        system_impact: Dict[str, Any] = {}
        target_info: Dict[str, Any] = {}
        msg = ""

        # 3. Handle Specific Command Types
        if cmd_type == "START_GENERATOR":
            gen = db.query(Equipment).filter(Equipment.id == command_req.target_id, Equipment.station_id == station_id).first()
            if not gen or gen.equipment_type != "GENERATOR":
                raise APIError(code="INVALID_TARGET", message=f"Generator #{command_req.target_id} not found.", status_code=404)

            target_info = {"equipment_id": gen.id, "name": gen.name}
            previous_state = {"status": gen.status, "temperature": gen.temperature, "efficiency": gen.efficiency}

            # Idempotent check
            if gen.status == "ONLINE":
                cmd.status = "COMPLETED"
                cmd.executed_at = now
                cmd.completed_at = now
                db.commit()
                return CommandResponse(
                    success=True,
                    command_id=cmd.id,
                    command_type=cmd_type,
                    station_id=station_id,
                    station_code=station.code,
                    status="COMPLETED",
                    target=target_info,
                    previous_state=previous_state,
                    new_state=previous_state,
                    system_impact={"generation_change_kw": 0.0},
                    message=f"{gen.name} is already ONLINE.",
                    executed_at=now,
                )

            # Safety Interlock
            safety_service.validate_generator_start_safety(db, station_id, gen)

            # State Transition: STARTING -> ONLINE
            cmd.status = "EXECUTING"
            gen.status = "ONLINE"
            gen.temperature = 72.0
            gen.efficiency = 95.0
            gen.health_score = max(gen.health_score, 88.0)
            new_state = {"status": "ONLINE", "temperature": 72.0, "efficiency": 95.0}

            # Microgrid Recalculation
            latest_energy = (
                db.query(EnergyTelemetry)
                .filter(EnergyTelemetry.station_id == station_id)
                .order_by(EnergyTelemetry.timestamp.desc())
                .first()
            )
            if latest_energy:
                gen_boost = 95.0
                prev_g = latest_energy.generation_kw
                latest_energy.diesel_generation_kw = round(latest_energy.diesel_generation_kw + gen_boost, 2)
                latest_energy.generation_kw = round(latest_energy.solar_generation_kw + latest_energy.diesel_generation_kw, 2)
                latest_energy.energy_balance = round(latest_energy.generation_kw - latest_energy.consumption_kw, 2)
                if latest_energy.energy_balance >= 0:
                    latest_energy.battery_power_kw = min(30.0, latest_energy.energy_balance)
                    latest_energy.grid_status = "ONLINE"
                else:
                    latest_energy.battery_power_kw = latest_energy.energy_balance
                    latest_energy.grid_status = "DEGRADED"

                system_impact = {
                    "generation_change_kw": gen_boost,
                    "new_generation_kw": latest_energy.generation_kw,
                    "new_energy_balance_kw": latest_energy.energy_balance,
                    "grid_status": latest_energy.grid_status,
                }

            # Acknowledge/Resolve Outage Alerts
            active_outage_alerts = db.query(Alert).filter(
                Alert.station_id == station_id,
                Alert.acknowledged == False,
                Alert.title.ilike("%Offline%"),
            ).all()
            for al in active_outage_alerts:
                al.acknowledged = True
                al.resolved_at = now

            msg = f"{gen.name} startup sequence completed. Online generation synchronized."

        elif cmd_type == "STOP_GENERATOR":
            gen = db.query(Equipment).filter(Equipment.id == command_req.target_id, Equipment.station_id == station_id).first()
            if not gen or gen.equipment_type != "GENERATOR":
                raise APIError(code="INVALID_TARGET", message=f"Generator #{command_req.target_id} not found.", status_code=404)

            target_info = {"equipment_id": gen.id, "name": gen.name}
            previous_state = {"status": gen.status}

            if gen.status in ["STANDBY", "OFFLINE"]:
                cmd.status = "COMPLETED"
                cmd.executed_at = now
                cmd.completed_at = now
                db.commit()
                return CommandResponse(
                    success=True,
                    command_id=cmd.id,
                    command_type=cmd_type,
                    station_id=station_id,
                    station_code=station.code,
                    status="COMPLETED",
                    target=target_info,
                    previous_state=previous_state,
                    new_state=previous_state,
                    system_impact={"generation_change_kw": 0.0},
                    message=f"{gen.name} is already {gen.status}.",
                    executed_at=now,
                )

            # Safety Interlock
            safety_service.validate_generator_stop_safety(db, station_id, gen)

            gen.status = "STANDBY"
            gen.temperature = 25.0
            new_state = {"status": "STANDBY", "temperature": 25.0}

            latest_energy = (
                db.query(EnergyTelemetry)
                .filter(EnergyTelemetry.station_id == station_id)
                .order_by(EnergyTelemetry.timestamp.desc())
                .first()
            )
            if latest_energy:
                gen_drop = min(latest_energy.diesel_generation_kw, 90.0)
                latest_energy.diesel_generation_kw = max(0.0, round(latest_energy.diesel_generation_kw - gen_drop, 2))
                latest_energy.generation_kw = round(latest_energy.solar_generation_kw + latest_energy.diesel_generation_kw, 2)
                latest_energy.energy_balance = round(latest_energy.generation_kw - latest_energy.consumption_kw, 2)
                latest_energy.battery_power_kw = latest_energy.energy_balance
                if latest_energy.energy_balance < 0:
                    latest_energy.grid_status = "DEGRADED"

                system_impact = {
                    "generation_change_kw": -gen_drop,
                    "new_generation_kw": latest_energy.generation_kw,
                    "new_energy_balance_kw": latest_energy.energy_balance,
                }

            msg = f"{gen.name} shutdown initiated and safely transitioned to STANDBY."

        elif cmd_type == "LOAD_SHED":
            params = command_req.parameters or {}
            group_ident = params.get("load_group", "NON_CRITICAL")
            res = operations_service.shed_load_group(db, station_id, group_ident, command_req.reason, command_req.requested_by)
            target_info = {"load_group": group_ident}
            previous_state = {"enabled": True}
            new_state = {"enabled": False, "shed_groups": res["shed_groups"]}
            system_impact = {"consumption_reduction_kw": res["shed_load_kw"], "new_balance_kw": res["new_energy_balance_kw"]}
            msg = res["message"]

        elif cmd_type == "LOAD_RESTORE":
            params = command_req.parameters or {}
            group_ident = params.get("load_group", "ALL")
            res = operations_service.restore_load_group(db, station_id, group_ident, command_req.reason, command_req.requested_by)
            target_info = {"load_group": group_ident}
            previous_state = {"enabled": False}
            new_state = {"enabled": True, "restored_groups": res["restored_groups"]}
            system_impact = {"consumption_increase_kw": res["restored_load_kw"], "new_balance_kw": res["new_energy_balance_kw"]}
            msg = res["message"]

        elif cmd_type in ["ENTER_EMERGENCY_MODE", "EXIT_EMERGENCY_MODE"]:
            enabled = (cmd_type == "ENTER_EMERGENCY_MODE")
            res = operations_service.set_emergency_mode(db, station_id, enabled, command_req.reason, command_req.requested_by)
            target_info = {"station": station.code}
            previous_state = {"operational_mode": "NORMAL" if enabled else "EMERGENCY"}
            new_state = {"operational_mode": res["operational_mode"]}
            system_impact = {"emergency_protocol_active": enabled}
            msg = res["message"]

        elif cmd_type in ["RESTART_EQUIPMENT", "SHUTDOWN_EQUIPMENT", "ISOLATE_EQUIPMENT"]:
            eq = db.query(Equipment).filter(Equipment.id == command_req.target_id, Equipment.station_id == station_id).first()
            if not eq:
                raise APIError(code="EQUIPMENT_NOT_FOUND", message=f"Equipment #{command_req.target_id} not found.", status_code=404)

            target_info = {"equipment_id": eq.id, "name": eq.name, "type": eq.equipment_type}
            previous_state = {"status": eq.status, "health": eq.health_score}

            if cmd_type == "SHUTDOWN_EQUIPMENT":
                safety_service.validate_equipment_shutdown_safety(eq, command_req.role, command_req.confirmed)
                eq.status = "OFFLINE"
                new_state = {"status": "OFFLINE"}
                msg = f"{eq.name} shut down by operator."
            elif cmd_type == "ISOLATE_EQUIPMENT":
                eq.status = "MAINTENANCE"
                new_state = {"status": "MAINTENANCE"}
                msg = f"{eq.name} isolated for maintenance."
            else: # RESTART_EQUIPMENT
                eq.status = "NORMAL"
                eq.health_score = max(eq.health_score, 85.0)
                new_state = {"status": "NORMAL", "health": eq.health_score}
                msg = f"{eq.name} restarted successfully."

        else:
            raise APIError(code="UNSUPPORTED_COMMAND", message=f"Command type '{cmd_type}' is not recognized.", status_code=400)

        # 4. Finalize Command Status
        cmd.status = "COMPLETED"
        cmd.executed_at = now
        cmd.completed_at = datetime.now(timezone.utc)
        cmd.previous_state_json = json.dumps(previous_state)
        cmd.resulting_state_json = json.dumps(new_state)

        # 5. Audit Logging
        audit_service.log_action(
            db=db,
            station_id=station_id,
            command_id=cmd.id,
            actor=command_req.requested_by,
            action=cmd_type,
            target=str(target_info),
            result="SUCCESS",
            previous_state=previous_state,
            new_state=new_state,
        )
        db.commit()
        db.refresh(cmd)

        # 6. WebSocket Event Broadcast
        await self._emit_event(
            station_code=station.code,
            event_type="COMMAND_COMPLETED",
            payload={
                "command_id": cmd.id,
                "command_type": cmd_type,
                "target": target_info,
                "new_state": new_state,
                "system_impact": system_impact,
                "message": msg,
            },
        )

        return CommandResponse(
            success=True,
            command_id=cmd.id,
            command_type=cmd_type,
            station_id=station_id,
            station_code=station.code,
            status="COMPLETED",
            target=target_info,
            previous_state=previous_state,
            new_state=new_state,
            system_impact=system_impact,
            message=msg,
            executed_at=cmd.executed_at,
        )


command_service = CommandService()
