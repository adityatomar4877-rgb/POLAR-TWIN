import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.copilot import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotStatusOut,
    DiagnosticResponse,
    RiskAssessmentResponse,
)
from app.services.llm_copilot_service import llm_copilot_service
from app.services.station_service import station_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="", tags=["AI Copilot & Risk Assessment"])


@router.post("/stations/{station_id}/copilot/chat", response_model=CopilotChatResponse)
async def chat_with_copilot(
    station_id: str,
    req: CopilotChatRequest,
    db: Session = Depends(get_db),
):
    """
    Interactive conversational LLM query with live Antarctic digital twin context.
    Evaluates real-time telemetry (energy balance, weather, equipment health, logistics reserves)
    to answer operator questions and provide executable command suggestions.
    """
    station = station_service.get_station_by_id_or_code(db, station_id)
    return await llm_copilot_service.chat(
        db=db,
        station_id=station.id,
        message=req.message,
        history=req.history,
        provider=req.provider,
        model=req.model,
    )


@router.post("/stations/{station_id}/copilot/assess-risk", response_model=RiskAssessmentResponse)
async def assess_station_risk(
    station_id: str,
    provider: Optional[str] = Query(None, description="Override LLM provider (ollama, openai, gemini, groq)"),
    model: Optional[str] = Query(None, description="Override model name"),
    db: Session = Depends(get_db),
):
    """
    Executes a comprehensive deep risk assessment of the station across all subsystems
    (Energy Microgrid, Atmospheric Hazard, Equipment Degradation, Logistics Autonomy)
    using the real LLM engine.
    """
    station = station_service.get_station_by_id_or_code(db, station_id)
    return await llm_copilot_service.assess_station_risk(
        db=db,
        station_id=station.id,
        provider=provider,
        model=model,
    )


@router.post("/stations/{station_id}/copilot/diagnose", response_model=DiagnosticResponse)
async def diagnose_station_health(
    station_id: str,
    provider: Optional[str] = Query(None, description="Override LLM provider (ollama, openai, gemini, groq)"),
    model: Optional[str] = Query(None, description="Override model name"),
    db: Session = Depends(get_db),
):
    """
    Synthesizes live station telemetry into diagnostic insights and ranked actionable
    operational recommendations.
    """
    station = station_service.get_station_by_id_or_code(db, station_id)
    return await llm_copilot_service.diagnose_station(
        db=db,
        station_id=station.id,
        provider=provider,
        model=model,
    )


@router.get("/copilot/status", response_model=CopilotStatusOut)
async def get_copilot_status():
    """
    Returns the real-time status of configured LLM providers (Ollama, OpenAI, Gemini, Groq),
    discovered local Ollama models, and whether fallback mode is active.
    """
    return await llm_copilot_service.get_copilot_status()
