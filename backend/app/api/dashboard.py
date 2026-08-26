from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.dashboard import StationDashboardOut
from app.schemas.station import StationOut
from app.schemas.sensor import SensorTelemetryOut
from app.schemas.energy import EnergyTelemetryOut
from app.schemas.equipment import EquipmentOut
from app.schemas.logistics import LogisticsItemOut
from app.schemas.alert import AlertOut
from app.services.station_service import station_service
from app.services.energy_service import energy_service
from app.services.logistics_service import logistics_service
from app.services.prediction_service import prediction_service
from app.services.alert_service import alert_service
from app.services.simulation_service import simulation_service
from app.models.sensor import SensorTelemetry

router = APIRouter(prefix="/stations/{station_id}/dashboard", tags=["Station Dashboard Aggregator"])


@router.get("", response_model=StationDashboardOut)
def get_station_dashboard_summary(station_id: str, db: Session = Depends(get_db)):
    """
    High-performance consolidated endpoint returning the complete Digital Twin station state.
    Provides station metadata, live environmental data, microgrid telemetry, equipment status,
    logistics inventories, active alerts, 24-hour predictive forecasts, and active simulation status.
    """
    station = station_service.get_station_by_id_or_code(db, station_id)
    
    # 1. Environment
    latest_sensor = (
        db.query(SensorTelemetry)
        .filter(SensorTelemetry.station_id == station.id)
        .order_by(SensorTelemetry.timestamp.desc())
        .first()
    )
    env_out = SensorTelemetryOut.model_validate(latest_sensor) if latest_sensor else None

    # 2. Energy
    latest_energy = energy_service.get_current_energy(db, station.id)
    energy_out = EnergyTelemetryOut.model_validate(latest_energy) if latest_energy else None

    # 3. Equipment
    eq_list = station.equipment
    equipment_out = [EquipmentOut.model_validate(eq) for eq in eq_list]

    # 4. Logistics
    logistics_list = logistics_service.get_items_by_station(db, station.id)
    logistics_out = [LogisticsItemOut.model_validate(it) for it in logistics_list]

    # 5. Alerts
    alerts = alert_service.get_alerts_by_station(db, station.id, limit=10)
    alerts_out = [AlertOut.model_validate(a) for a in alerts]

    # 6. Predictions
    from app.services.energy_forecast_service import energy_forecast_service
    energy_forecast = energy_forecast_service.predict(db, station.id, station.code)
    fuel_forecast = prediction_service.forecast_fuel_depletion(db, station.id, station.code)
    predictions_out = {
        "energy_forecast": energy_forecast,
        "energy_forecast_24h": energy_forecast,
        "fuel_forecast": fuel_forecast.model_dump(),
    }

    # 7. Simulation State
    sim_status = simulation_service.get_status()
    st_code = station.code.upper()
    sim_out = {
        "is_running": sim_status.is_running,
        "interval_seconds": sim_status.interval_seconds,
        "active_scenario": sim_status.active_scenarios.get(st_code, "NORMAL_OPERATION"),
        "scenario_expiry": sim_status.active_scenario_expiry.get(st_code),
        "total_cycles_executed": sim_status.total_cycles_executed,
    }

    # 8. Operations & Remote Management
    from app.services.operations_service import operations_service
    from app.services.maintenance_service import maintenance_service
    from app.models.command import Command

    ops_status = operations_service.get_operations_status(db, station.id)
    maint_tasks = maintenance_service.get_maintenance_tasks(db, station.id)
    resupply_reqs = maintenance_service.get_resupply_requests(db, station.id)

    operations_out = {
        "operational_mode": ops_status.operational_mode,
        "active_commands_count": ops_status.active_commands_count,
        "active_recommendations_count": ops_status.active_recommendations_count,
        "load_shed_active": ops_status.load_shed_active,
        "total_active_load_kw": ops_status.total_active_load_kw,
        "total_shed_load_kw": ops_status.total_shed_load_kw,
    }

    recs_out = [r.model_dump() for r in ops_status.active_recommendations]

    maintenance_summary_out = {
        "total_tasks": len(maint_tasks),
        "open_tasks": len([t for t in maint_tasks if t.status in ["OPEN", "SCHEDULED", "IN_PROGRESS"]]),
        "completed_tasks": len([t for t in maint_tasks if t.status == "COMPLETED"]),
    }

    resupply_summary_out = {
        "total_requests": len(resupply_reqs),
        "pending_requests": len([r for r in resupply_reqs if r.status in ["REQUESTED", "APPROVED", "IN_TRANSIT"]]),
    }

    loads_out = [l.model_dump() for l in ops_status.loads]

    return StationDashboardOut(
        station=StationOut.model_validate(station),
        environment=env_out,
        energy=energy_out,
        equipment=equipment_out,
        logistics=logistics_out,
        alerts=alerts_out,
        predictions=predictions_out,
        simulation=sim_out,
        operations=operations_out,
        recommendations=recs_out,
        maintenance_summary=maintenance_summary_out,
        resupply_summary=resupply_summary_out,
        loads=loads_out,
    )
