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
        Provides projected generation changes, deficit relief, energy deltas, and safety warnings.
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
        current_bal = latest_energy.energy_balance if latest_energy else round(current_gen - current_con, 2)
        current_bat = latest_energy.battery_percentage if (latest_energy and latest_energy.battery_percentage is not None) else 85.0

        safe = True
        requires_conf = safety_service.is_high_risk(cmd_type)
        warnings: List[str] = []
        recommendations: List[str] = []
        projected_state: Dict[str, Any] = {}
        impact: Dict[str, Any] = {}

        if cmd_type in ["START_GENERATOR", "START_EQUIPMENT"]:
            target_eq = None
            if preview_req.target_id:
                target_eq = db.query(Equipment).filter(Equipment.id == preview_req.target_id).first()

            is_gen = (target_eq is None or target_eq.equipment_type == "GENERATOR")
            gen_boost = 90.0 if is_gen else 0.0
            con_change = 0.0 if is_gen else 15.0
            proj_gen = round(current_gen + gen_boost, 2)
            proj_con = round(current_con + con_change, 2)
            proj_bal = round(proj_gen - proj_con, 2)
            proj_bat = min(100.0, current_bat + 5.0) if proj_bal >= 0 else current_bat
            
            projected_state = {
                "target_equipment": target_eq.name if target_eq else "Generator 2",
                "target_status": "ONLINE",
                "generation_kw": proj_gen,
                "consumption_kw": proj_con,
                "energy_balance": proj_bal,
                "energy_balance_kw": proj_bal,
                "projected_generation_kw": proj_gen,
                "projected_energy_balance_kw": proj_bal,
                "battery_percentage": proj_bat,
                "projected_grid_status": "ONLINE" if proj_bal >= 0 else "DEGRADED",
            }
            impact = {
                "energy_delta_kw": gen_boost if is_gen else -con_change,
                "generation_change_kw": gen_boost,
                "energy_balance_change_kw": round(proj_bal - current_bal, 2),
                "battery_drop_percent": round(proj_bat - current_bat, 2),
                "battery_discharge_reduction_kw": abs(min(0.0, current_bal)),
                "fuel_consumption_resumption_l_per_h": round(gen_boost * 0.26, 1) if is_gen else 0.0,
                "risk_level": "LOW",
                "description": f"Startup sequence for {target_eq.name if target_eq else 'Generator'}",
            }
            recommendations.append("Starting generator will eliminate microgrid power deficit and halt battery depletion.")

        elif cmd_type in ["STOP_GENERATOR", "STOP_EQUIPMENT", "SHUTDOWN_EQUIPMENT"]:
            target_eq = None
            if preview_req.target_id:
                target_eq = db.query(Equipment).filter(Equipment.id == preview_req.target_id).first()
                if target_eq and target_eq.equipment_type == "GENERATOR":
                    try:
                        safety_service.validate_generator_stop_safety(db, station_id, target_eq)
                    except APIError as ae:
                        safe = False
                        warnings.append(ae.message)
                elif target_eq:
                    try:
                        safety_service.validate_equipment_shutdown_safety(target_eq, "OPERATOR", False)
                    except APIError as ae:
                        safe = False
                        warnings.append(ae.message)

            is_gen = (target_eq is None or target_eq.equipment_type == "GENERATOR")
            gen_drop = min(latest_energy.diesel_generation_kw, 90.0) if (latest_energy and latest_energy.diesel_generation_kw > 0) else 90.0
            proj_gen = max(0.0, round(current_gen - (gen_drop if is_gen else 0.0), 2))
            proj_con = max(20.0, round(current_con - (0.0 if is_gen else 15.0), 2))
            proj_bal = round(proj_gen - proj_con, 2)
            proj_bat = max(10.0, current_bat - 8.0) if proj_bal < 0 else current_bat

            projected_state = {
                "target_equipment": target_eq.name if target_eq else "Generator",
                "target_status": "STANDBY" if is_gen else "OFFLINE",
                "generation_kw": proj_gen,
                "consumption_kw": proj_con,
                "energy_balance": proj_bal,
                "energy_balance_kw": proj_bal,
                "projected_generation_kw": proj_gen,
                "projected_energy_balance_kw": proj_bal,
                "battery_percentage": proj_bat,
                "projected_grid_status": "ONLINE" if proj_bal >= 0 else "DEGRADED",
            }
            impact = {
                "energy_delta_kw": -gen_drop if is_gen else 15.0,
                "generation_change_kw": -gen_drop if is_gen else 0.0,
                "energy_balance_change_kw": round(proj_bal - current_bal, 2),
                "battery_drop_percent": round(proj_bat - current_bat, 2),
                "risk_level": "HIGH" if (not safe or proj_bal < 0) else "MEDIUM",
                "description": f"Shutdown sequence for {target_eq.name if target_eq else 'Equipment'}",
            }
            if proj_bal < 0:
                warnings.append(f"Stopping generator will create a {abs(proj_bal):.1f} kW power deficit on station battery.")

        elif cmd_type == "LOAD_SHED":
            from app.models.audit import LoadGroup
            params = preview_req.parameters or {}
            group_ident = str(params.get("load_group") or preview_req.target_id or "NON_CRITICAL").upper()

            all_loads = db.query(LoadGroup).filter(LoadGroup.station_id == station_id).all()
            if group_ident in ["NON_CRITICAL", "ALL"]:
                target_loads = [l for l in all_loads if l.category == "NON_CRITICAL"]
            else:
                target_loads = [
                    l for l in all_loads
                    if (str(l.id) == group_ident or l.name.upper() == group_ident or l.category.upper() == group_ident)
                ]

            # Check for critical load safety
            for l in target_loads:
                if l.category == "CRITICAL":
                    safe = False
                    warnings.append(f"Safety interlock violation: {l.name} is a CRITICAL life-support system and cannot be shed.")

            active_shedable = [l for l in target_loads if l.enabled]
            nominal_shed_kw = sum(l.current_power_kw for l in target_loads)
            actual_shed_kw = sum(l.current_power_kw for l in active_shedable)

            # If all matching loads are already shed, use nominal load for projection but add warning
            effective_shed_kw = actual_shed_kw if actual_shed_kw > 0 else nominal_shed_kw
            proj_con = max(20.0, round(current_con - effective_shed_kw, 2))
            proj_bal = round(current_gen - proj_con, 2)
            proj_bat = min(100.0, round(current_bat + 4.0, 1)) if proj_bal >= 0 else current_bat

            if actual_shed_kw == 0 and len(target_loads) > 0:
                warnings.append("Note: Matching non-critical load circuits are currently already offline / shed.")
                recommendations.append("All non-critical loads are currently offline. Use RESTORE_ALL_LOADS to re-enable circuits, or START_GENERATOR to boost generation.")
            else:
                names = ", ".join(l.name for l in active_shedable) or "Non-critical circuits"
                recommendations.append(f"Shedding non-critical loads ({names}) will relieve station microgrid by {actual_shed_kw:.1f} kW.")

            projected_state = {
                "shed_groups_count": len(active_shedable) if actual_shed_kw > 0 else len(target_loads),
                "generation_kw": current_gen,
                "consumption_kw": proj_con,
                "energy_balance": proj_bal,
                "energy_balance_kw": proj_bal,
                "projected_consumption_kw": proj_con,
                "projected_energy_balance_kw": proj_bal,
                "battery_percentage": proj_bat,
            }
            impact = {
                "energy_delta_kw": effective_shed_kw,
                "consumption_reduction_kw": effective_shed_kw,
                "deficit_reduction_kw": effective_shed_kw,
                "energy_balance_change_kw": round(proj_bal - current_bal, 2),
                "battery_drop_percent": round(proj_bat - current_bat, 2),
                "risk_level": "LOW" if safe else "HIGH",
                "description": f"Shed {len(active_shedable) or len(target_loads)} non-critical load group(s)",
            }

        elif cmd_type == "LOAD_RESTORE":
            from app.models.audit import LoadGroup
            params = preview_req.parameters or {}
            group_ident = str(params.get("load_group", "ALL")).upper()

            all_loads = db.query(LoadGroup).filter(LoadGroup.station_id == station_id).all()
            if group_ident in ["ALL", "NON_CRITICAL"]:
                target_loads = [l for l in all_loads if not l.enabled]
            else:
                target_loads = [
                    l for l in all_loads
                    if not l.enabled and (str(l.id) == group_ident or l.name.upper() == group_ident or l.category.upper() == group_ident)
                ]

            restore_kw = sum(l.current_power_kw for l in target_loads)
            proj_con = round(current_con + restore_kw, 2)
            proj_bal = round(current_gen - proj_con, 2)
            proj_bat = max(10.0, current_bat - 5.0) if proj_bal < 0 else current_bat

            if len(target_loads) == 0:
                warnings.append("All electrical load circuits are currently energized and online.")
                recommendations.append("All circuits are currently active. No disabled loads to restore.")
            else:
                names = ", ".join(l.name for l in target_loads)
                recommendations.append(f"Restoring {len(target_loads)} circuit(s) ({names}) will resume full operations (+{restore_kw:.1f} kW).")
                if proj_bal < 0:
                    warnings.append(f"Restoring loads will create a {abs(proj_bal):.1f} kW power deficit on station battery.")

            projected_state = {
                "restored_groups_count": len(target_loads),
                "generation_kw": current_gen,
                "consumption_kw": proj_con,
                "energy_balance": proj_bal,
                "energy_balance_kw": proj_bal,
                "projected_consumption_kw": proj_con,
                "projected_energy_balance_kw": proj_bal,
                "battery_percentage": proj_bat,
            }
            impact = {
                "energy_delta_kw": -restore_kw,
                "consumption_increase_kw": restore_kw,
                "energy_balance_change_kw": round(proj_bal - current_bal, 2),
                "battery_drop_percent": round(proj_bat - current_bat, 2),
                "risk_level": "MEDIUM" if proj_bal < 0 else "LOW",
                "description": f"Restore {len(target_loads)} shed circuit(s)",
            }

        elif cmd_type in ["RESTART_EQUIPMENT", "ISOLATE_EQUIPMENT"]:
            target_eq = None
            if preview_req.target_id:
                target_eq = db.query(Equipment).filter(Equipment.id == preview_req.target_id).first()

            is_isolate = (cmd_type == "ISOLATE_EQUIPMENT")
            projected_state = {
                "target_equipment": target_eq.name if target_eq else "Equipment",
                "target_status": "MAINTENANCE" if is_isolate else "NORMAL",
                "generation_kw": current_gen,
                "consumption_kw": current_con,
                "energy_balance": current_bal,
                "energy_balance_kw": current_bal,
                "battery_percentage": current_bat,
            }
            impact = {
                "energy_delta_kw": 0.0,
                "energy_balance_change_kw": 0.0,
                "risk_level": "LOW",
                "description": f"{'Lock out and isolate' if is_isolate else 'Reboot sequence for'} {target_eq.name if target_eq else 'equipment'}",
            }
            recommendations.append(f"{'Isolate unit for scheduled maintenance lock-out.' if is_isolate else 'Restarting equipment will clear transient software faults.'}")

        else:
            projected_state = {
                "status": "ACKNOWLEDGED",
                "generation_kw": current_gen,
                "consumption_kw": current_con,
                "energy_balance": current_bal,
                "energy_balance_kw": current_bal,
                "battery_percentage": current_bat,
            }
            impact = {
                "energy_delta_kw": 0.0,
                "status_change": True,
                "risk_level": "LOW",
            }

        return CommandPreviewResponse(
            command_type=cmd_type,
            safe=safe,
            requires_confirmation=requires_conf,
            current_state={
                "generation_kw": current_gen,
                "consumption_kw": current_con,
                "energy_balance": current_bal,
                "energy_balance_kw": current_bal,
                "battery_percentage": current_bat,
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
