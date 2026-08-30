from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.operations import OperationalRecommendationOut


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Text content of the message")
    timestamp: Optional[str] = None


class SuggestedCommand(BaseModel):
    title: str
    command_type: str
    target_type: str = "EQUIPMENT"
    target_id: Optional[int] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    severity: str = "INFO"
    rationale: str = ""


class CopilotChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="Operator prompt or question")
    history: List[ChatMessage] = Field(default_factory=list, description="Recent conversation turns")
    station_id: Optional[str] = Field("bharati", description="Target station ID or code")
    provider: Optional[str] = Field(None, description="Override LLM provider ('ollama', 'openai', 'gemini', 'groq')")
    model: Optional[str] = Field(None, description="Override model name")
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)


class CopilotChatResponse(BaseModel):
    answer: str
    risk_level: str = "NOMINAL"
    risk_score: float = 0.0
    cited_telemetry: Dict[str, Any] = Field(default_factory=dict)
    suggested_actions: List[SuggestedCommand] = Field(default_factory=list)
    model_used: str
    provider: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DomainRiskScore(BaseModel):
    score: float = Field(..., ge=0.0, le=100.0, description="Risk score 0-100 (0=Safe, 100=Critical)")
    status: str = Field(..., description="NOMINAL, GUARDED, ELEVATED, HIGH, or CRITICAL")
    key_factors: List[str] = Field(default_factory=list)


class RiskAssessmentResponse(BaseModel):
    station_id: int
    station_code: str
    station_name: str
    overall_score: float = Field(..., ge=0.0, le=100.0)
    risk_level: str = "NOMINAL"
    summary: str
    energy_risk: DomainRiskScore
    weather_risk: DomainRiskScore
    equipment_risk: DomainRiskScore
    logistics_risk: DomainRiskScore
    vulnerabilities: List[str] = Field(default_factory=list)
    immediate_mitigations: List[str] = Field(default_factory=list)
    suggested_commands: List[SuggestedCommand] = Field(default_factory=list)
    telemetry_snapshot: Dict[str, Any] = Field(default_factory=dict)
    model_used: str
    provider: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DiagnosticResponse(BaseModel):
    station_id: int
    station_name: str
    diagnostic_summary: str
    subsystems_status: Dict[str, str] = Field(default_factory=dict)
    active_anomalies_count: int = 0
    recommendations: List[OperationalRecommendationOut] = Field(default_factory=list)
    model_used: str
    provider: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CopilotStatusOut(BaseModel):
    active_provider: str
    configured_model: str
    ollama_available: bool
    ollama_models: List[str] = Field(default_factory=list)
    openai_available: bool
    gemini_available: bool
    groq_available: bool
    fallback_active: bool
    ollama_base_url: str
