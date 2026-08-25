from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.simulation import ScenarioRequest, ScenarioResponse, SimulationStatusOut
from app.services.simulation_service import simulation_service
from app.core.security import APIError

router = APIRouter(prefix="/simulation", tags=["Simulation Engine & What-If Scenarios"])

VALID_SCENARIOS = {
    "NORMAL_OPERATION",
    "GENERATOR_FAILURE",
    "EXTREME_COLD",
    "HIGH_ENERGY_DEMAND",
    "FUEL_SHORTAGE",
    "EQUIPMENT_DEGRADATION",
    "SUPPLY_DELAY",
}


@router.get("/status", response_model=SimulationStatusOut)
def get_simulation_status():
    """Retrieves current simulation lifecycle status, tick interval, active scenarios, and cycles executed."""
    return simulation_service.get_status()


@router.post("/start")
def start_simulation():
    """Resumes or starts the background Digital Twin simulation cycle."""
    running = simulation_service.start()
    return {"success": True, "message": "Digital Twin simulation started.", "is_running": running}


@router.post("/stop")
def stop_simulation():
    """Pauses the background Digital Twin simulation cycle."""
    running = simulation_service.stop()
    return {"success": True, "message": "Digital Twin simulation paused.", "is_running": running}


@router.post("/reset")
def reset_simulation(db: Session = Depends(get_db)):
    """Resets all stations back to standard nominal operation (NORMAL_OPERATION) and clears active failures."""
    res = simulation_service.reset(db)
    return {"success": True, "message": res["message"]}


@router.post("/scenario", response_model=ScenarioResponse)
def trigger_scenario(
    request: ScenarioRequest,
    db: Session = Depends(get_db),
):
    """
    Executes What-If simulation scenarios (e.g. GENERATOR_FAILURE, EXTREME_COLD, HIGH_ENERGY_DEMAND, FUEL_SHORTAGE).
    Calculates immediate system impacts, affected subsystems, and operational recommendations.
    """
    scenario_clean = request.scenario.strip().upper()
    if scenario_clean not in VALID_SCENARIOS:
        raise APIError(
            code="INVALID_SCENARIO",
            message=f"Scenario '{request.scenario}' is not recognized. Valid options: {sorted(list(VALID_SCENARIOS))}",
            status_code=400,
        )

    return simulation_service.apply_scenario(db, request)
