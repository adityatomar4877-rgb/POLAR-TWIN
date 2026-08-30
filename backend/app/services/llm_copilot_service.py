import json
import logging
import math
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.audit import AuditLog, LoadGroup, OperationalRecommendation
from app.models.command import Command
from app.models.energy import EnergyTelemetry
from app.models.equipment import Equipment
from app.models.logistics import LogisticsItem
from app.models.maintenance import MaintenanceTask, ResupplyRequest
from app.models.prediction import Prediction
from app.models.sensor import SensorTelemetry
from app.models.station import Station
from app.schemas.copilot import (
    ChatMessage,
    CopilotChatResponse,
    CopilotStatusOut,
    DiagnosticResponse,
    DomainRiskScore,
    RiskAssessmentResponse,
    SuggestedCommand,
)
from app.schemas.operations import OperationalRecommendationOut

logger = logging.getLogger(__name__)


class LLMCopilotService:
    @staticmethod
    def _get_client(timeout_secs: float = 10.0, connect_secs: float = 1.5) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=httpx.Timeout(timeout_secs, connect=connect_secs))

    # ------------------------------------------------------------------
    # Telemetry Harvester
    # ------------------------------------------------------------------
    @staticmethod
    def harvest_station_telemetry(db: Session, station_id: int) -> Dict[str, Any]:
        """
        Extracts a unified digital twin snapshot of the station:
        microgrid energy, atmospheric sensors, equipment health,
        logistics reserves, active alerts, load groups, and recent commands.
        """
        station = db.query(Station).filter(Station.id == station_id).first()
        station_info = {
            "id": station.id if station else station_id,
            "name": station.name if station else "Polar Station",
            "code": station.code if station else "STATION",
            "status": station.status if station else "OPERATIONAL",
            "latitude": station.latitude if station else -69.4,
            "longitude": station.longitude if station else 76.2,
            "elevation_m": station.elevation if station else 30.0,
            "ice_class": "A1",
        }

        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        energy_data = {
            "generation_kw": latest_energy.generation_kw if latest_energy else 0.0,
            "consumption_kw": latest_energy.consumption_kw if latest_energy else 0.0,
            "energy_balance_kw": latest_energy.energy_balance if latest_energy else 0.0,
            "solar_kw": latest_energy.solar_generation_kw if latest_energy else 0.0,
            "wind_kw": latest_energy.wind_generation_kw if latest_energy else 0.0,
            "diesel_kw": latest_energy.diesel_generation_kw if latest_energy else 0.0,
            "battery_percentage": latest_energy.battery_percentage if latest_energy else 0.0,
            "battery_power_kw": latest_energy.battery_power_kw if latest_energy else 0.0,
            "fuel_percentage": latest_energy.fuel_percentage if latest_energy else 0.0,
            "grid_status": latest_energy.grid_status if latest_energy else "ONLINE",
        }

        latest_env = (
            db.query(SensorTelemetry)
            .filter(SensorTelemetry.station_id == station_id)
            .order_by(SensorTelemetry.timestamp.desc())
            .first()
        )
        outdoor_temp = latest_env.temperature if latest_env else -22.0
        wind_speed = latest_env.wind_speed if latest_env else 35.0
        # Standard Siple-Passel / Jagti Antarctic wind chill approximation
        wind_chill = round(outdoor_temp - (wind_speed * 0.16), 1)
        env_data = {
            "outdoor_temp_c": outdoor_temp,
            "indoor_temp_c": 21.0,
            "wind_speed_kmh": wind_speed,
            "wind_direction_deg": latest_env.wind_direction if latest_env else 145.0,
            "pressure_hpa": latest_env.pressure if latest_env else 982.0,
            "humidity_pct": latest_env.humidity if latest_env else 65.0,
            "solar_radiation_wm2": latest_env.solar_irradiance_wm2 if latest_env else 45.0,
            "wind_chill_c": wind_chill,
            "blizzard_risk": "HIGH" if wind_speed > 65.0 else ("MODERATE" if wind_speed > 45.0 else "LOW"),
        }

        equipment_rows = db.query(Equipment).filter(Equipment.station_id == station_id).all()
        equipment_list = [
            {
                "id": eq.id,
                "name": eq.name,
                "type": eq.equipment_type,
                "status": eq.status,
                "health_score": round(eq.health_score, 1),
                "temperature_c": round(eq.temperature, 1),
                "efficiency_pct": round(eq.efficiency, 1),
                "runtime_hours": eq.runtime_hours,
            }
            for eq in equipment_rows
        ]

        logistics_rows = db.query(LogisticsItem).filter(LogisticsItem.station_id == station_id).all()
        logistics_list = [
            {
                "id": item.id,
                "name": item.item_name,
                "category": item.category,
                "quantity": round(item.quantity, 1),
                "unit": item.unit,
                "daily_consumption": round(item.daily_consumption, 2),
                "days_remaining": round(item.days_remaining, 1),
                "minimum_threshold": round(item.minimum_threshold, 1),
                "status": item.status,
            }
            for item in logistics_rows
        ]

        alerts_rows = (
            db.query(Alert)
            .filter(Alert.station_id == station_id, Alert.resolved_at.is_(None))
            .order_by(Alert.created_at.desc())
            .limit(10)
            .all()
        )
        alerts_list = [
            {
                "id": a.id,
                "severity": a.severity,
                "title": a.title,
                "message": a.message,
                "source": a.source,
                "timestamp": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts_rows
        ]

        loads_rows = db.query(LoadGroup).filter(LoadGroup.station_id == station_id).order_by(LoadGroup.priority.asc()).all()
        loads_list = [
            {
                "id": l.id,
                "name": l.name,
                "category": l.category,
                "priority": l.priority,
                "power_kw": round(l.current_power_kw, 1),
                "enabled": l.enabled,
            }
            for l in loads_rows
        ]

        recent_audits = (
            db.query(AuditLog)
            .filter(AuditLog.station_id == station_id)
            .order_by(AuditLog.timestamp.desc())
            .limit(5)
            .all()
        )
        audits_list = [
            {
                "action": a.action,
                "actor": a.actor,
                "target": a.target,
                "result": a.result,
            }
            for a in recent_audits
        ]

        return {
            "station": station_info,
            "energy": energy_data,
            "environment": env_data,
            "equipment": equipment_list,
            "logistics": logistics_list,
            "active_alerts": alerts_list,
            "load_groups": loads_list,
            "recent_actions": audits_list,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # Provider Check & Model Discovery
    # ------------------------------------------------------------------
    async def get_copilot_status(self) -> CopilotStatusOut:
        """Inspects availability of Ollama, OpenAI, Gemini, and Groq."""
        ollama_available = False
        ollama_models: List[str] = []
        base_url = settings.OLLAMA_BASE_URL.rstrip("/")

        try:
            async with self._get_client(timeout_secs=1.5, connect_secs=0.8) as client:
                r = await client.get(f"{base_url}/api/tags")
                if r.status_code == 200:
                    data = r.json()
                    ollama_available = True
                    ollama_models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
        except Exception:
            ollama_available = False

        openai_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
        gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
        groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")

        active_provider = settings.LLM_PROVIDER.lower()
        if active_provider == "auto":
            if ollama_available:
                active_provider = "ollama"
            elif openai_key:
                active_provider = "openai"
            elif gemini_key:
                active_provider = "gemini"
            elif groq_key:
                active_provider = "groq"
            else:
                active_provider = "deterministic_offline"

        configured_model = settings.OLLAMA_MODEL if active_provider == "ollama" else (
            settings.OPENAI_MODEL if active_provider == "openai" else (
                settings.GEMINI_MODEL if active_provider == "gemini" else (
                    settings.GROQ_MODEL if active_provider == "groq" else "polaris-neural-v1"
                )
            )
        )

        return CopilotStatusOut(
            active_provider=active_provider,
            configured_model=configured_model,
            ollama_available=ollama_available,
            ollama_models=ollama_models,
            openai_available=bool(openai_key),
            gemini_available=bool(gemini_key),
            groq_available=bool(groq_key),
            fallback_active=(not ollama_available and not openai_key and not gemini_key and not groq_key),
            ollama_base_url=settings.OLLAMA_BASE_URL,
        )

    # ------------------------------------------------------------------
    # Real LLM API Dispatchers (Ollama, OpenAI, Gemini, Groq)
    # ------------------------------------------------------------------
    async def _call_ollama(
        self,
        prompt: str,
        system_prompt: str,
        model: Optional[str] = None,
        history: Optional[List[ChatMessage]] = None,
        json_format: bool = False,
    ) -> Optional[str]:
        base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        target_model = model or settings.OLLAMA_MODEL or "llama3.2"

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for h in history[-6:]:
                messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": settings.LLM_TEMPERATURE,
            },
        }
        if json_format:
            payload["format"] = "json"

        connected = False
        try:
            logger.info("Dispatching prompt to Ollama at %s/api/chat (model: %s)", base_url, target_model)
            async with self._get_client(timeout_secs=settings.LLM_TIMEOUT_SECONDS, connect_secs=0.6) as client:
                r = await client.post(f"{base_url}/api/chat", json=payload)
                connected = True
                if r.status_code == 200:
                    data = r.json()
                    content = data.get("message", {}).get("content", "")
                    if content:
                        return content.strip()
        except Exception as e:
            logger.warning("Ollama API call failed: %s. Trying fallback.", e)

        # If connected but 404 on chat (e.g. older Ollama version), try generate endpoint
        if connected:
            try:
                full_prompt = f"{system_prompt}\n\nOperator: {prompt}\nCopilot:"
                gen_payload = {
                    "model": target_model,
                    "prompt": full_prompt,
                    "stream": False,
                }
                if json_format:
                    gen_payload["format"] = "json"
                async with self._get_client(timeout_secs=settings.LLM_TIMEOUT_SECONDS, connect_secs=0.6) as client:
                    r = await client.post(f"{base_url}/api/generate", json=gen_payload)
                    if r.status_code == 200:
                        data = r.json()
                        content = data.get("response", "")
                        if content:
                            return content.strip()
            except Exception as e:
                logger.warning("Ollama /api/generate fallback also failed: %s", e)

        return None

    async def _call_openai_compatible(
        self,
        prompt: str,
        system_prompt: str,
        model: str,
        base_url: str,
        api_key: str,
        history: Optional[List[ChatMessage]] = None,
        json_format: bool = False,
    ) -> Optional[str]:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for h in history[-6:]:
                messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": settings.LLM_TEMPERATURE,
        }
        if json_format:
            payload["response_format"] = {"type": "json_object"}

        try:
            endpoint = f"{base_url.rstrip('/')}/chat/completions"
            async with self._get_client(timeout_secs=settings.LLM_TIMEOUT_SECONDS, connect_secs=3.0) as client:
                r = await client.post(endpoint, json=payload, headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    content = data["choices"][0]["message"]["content"]
                    return content.strip()
                else:
                    logger.warning("OpenAI compatible endpoint returned %d: %s", r.status_code, r.text)
        except Exception as e:
            logger.warning("OpenAI compatible call to %s failed: %s", base_url, e)

        return None

    async def _call_gemini(
        self,
        prompt: str,
        system_prompt: str,
        model: str,
        api_key: str,
        json_format: bool = False,
    ) -> Optional[str]:
        target_model = model or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
        
        system_instruction = {"parts": [{"text": system_prompt}]}
        contents = [{"parts": [{"text": prompt}]}]
        payload: Dict[str, Any] = {
            "system_instruction": system_instruction,
            "contents": contents,
            "generationConfig": {
                "temperature": settings.LLM_TEMPERATURE,
            },
        }
        if json_format:
            payload["generationConfig"]["response_mime_type"] = "application/json"

        try:
            async with self._get_client(timeout_secs=settings.LLM_TIMEOUT_SECONDS, connect_secs=3.0) as client:
                r = await client.post(url, json=payload)
                if r.status_code == 200:
                    data = r.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()
        except Exception as e:
            logger.warning("Gemini call failed: %s", e)

        return None

    async def _dispatch_llm(
        self,
        prompt: str,
        system_prompt: str,
        provider_override: Optional[str] = None,
        model_override: Optional[str] = None,
        history: Optional[List[ChatMessage]] = None,
        json_format: bool = False,
    ) -> Tuple[Optional[str], str, str]:
        """
        Executes query against the best available provider in priority order:
        Ollama -> OpenAI -> Gemini -> Groq.
        Returns: (response_text, provider_used, model_used)
        """
        provider = (provider_override or settings.LLM_PROVIDER).lower()

        # If user explicitly requested or auto-chose Ollama
        if provider in ["ollama", "auto"]:
            text = await self._call_ollama(
                prompt,
                system_prompt,
                model=model_override or settings.OLLAMA_MODEL,
                history=history,
                json_format=json_format,
            )
            if text:
                return text, "ollama", model_override or settings.OLLAMA_MODEL

        # OpenAI
        openai_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
        if (provider in ["openai", "auto"] or not provider_override) and openai_key:
            model = model_override if (model_override and provider == "openai") else settings.OPENAI_MODEL
            text = await self._call_openai_compatible(
                prompt,
                system_prompt,
                model=model,
                base_url=settings.OPENAI_BASE_URL,
                api_key=openai_key,
                history=history,
                json_format=json_format,
            )
            if text:
                return text, "openai", model

        # Gemini
        gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
        if (provider in ["gemini", "auto"] or not provider_override) and gemini_key:
            model = model_override if (model_override and provider == "gemini") else settings.GEMINI_MODEL
            text = await self._call_gemini(
                prompt,
                system_prompt,
                model=model,
                api_key=gemini_key,
                json_format=json_format,
            )
            if text:
                return text, "gemini", model

        # Groq
        groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        if (provider in ["groq", "auto"] or not provider_override) and groq_key:
            model = model_override if (model_override and provider == "groq") else settings.GROQ_MODEL
            text = await self._call_openai_compatible(
                prompt,
                system_prompt,
                model=model,
                base_url="https://api.groq.com/openai/v1",
                api_key=groq_key,
                history=history,
                json_format=json_format,
            )
            if text:
                return text, "groq", model

        return None, "deterministic_offline", "polaris-digital-twin-engine"

    # ------------------------------------------------------------------
    # Deterministic Reasoning Fallback Engine
    # ------------------------------------------------------------------
    def _deterministic_risk_assessment(self, telemetry: Dict[str, Any]) -> RiskAssessmentResponse:
        energy = telemetry.get("energy", {})
        env = telemetry.get("environment", {})
        equipment = telemetry.get("equipment", [])
        logistics = telemetry.get("logistics", [])
        alerts = telemetry.get("active_alerts", [])
        station = telemetry.get("station", {})

        # Energy Risk Calculation (0-100)
        net_kw = energy.get("energy_balance_kw", 0.0)
        battery_soc = energy.get("battery_percentage", 100.0)
        energy_score = 10.0
        energy_factors = []
        if net_kw < -20.0:
            energy_score += 45.0
            energy_factors.append(f"Severe power deficit of {abs(net_kw):.1f} kW discharging battery")
        elif net_kw < -5.0:
            energy_score += 25.0
            energy_factors.append(f"Moderate power deficit of {abs(net_kw):.1f} kW")
        
        if battery_soc < 25.0:
            energy_score += 35.0
            energy_factors.append(f"Battery storage critically low at {battery_soc:.0f}%")
        elif battery_soc < 50.0:
            energy_score += 15.0
            energy_factors.append(f"Battery storage depleted to {battery_soc:.0f}%")
        
        energy_score = min(100.0, energy_score)
        energy_status = "CRITICAL" if energy_score >= 75 else ("HIGH" if energy_score >= 50 else ("GUARDED" if energy_score >= 30 else "NOMINAL"))

        # Weather / Environmental Risk Calculation
        wind_speed = env.get("wind_speed_kmh", 25.0)
        chill = env.get("wind_chill_c", -25.0)
        weather_score = 10.0
        weather_factors = []
        if wind_speed > 80.0 or chill < -45.0:
            weather_score += 65.0
            weather_factors.append(f"Blizzard storm alert: Wind {wind_speed:.0f} km/h, Wind Chill {chill:.0f}°C")
        elif wind_speed > 60.0 or chill < -35.0:
            weather_score += 40.0
            weather_factors.append(f"Severe wind conditions ({wind_speed:.0f} km/h), high wind chill ({chill:.0f}°C)")
        elif wind_speed > 40.0:
            weather_score += 20.0
            weather_factors.append(f"Elevated wind gusting at {wind_speed:.0f} km/h")
        weather_score = min(100.0, weather_score)
        weather_status = "CRITICAL" if weather_score >= 75 else ("HIGH" if weather_score >= 50 else ("GUARDED" if weather_score >= 30 else "NOMINAL"))

        # Equipment Risk Calculation
        offline_count = len([e for e in equipment if e.get("status") in ["OFFLINE", "FAILED"]])
        degraded_count = len([e for e in equipment if e.get("health_score", 100) < 60])
        eq_score = 5.0 + (offline_count * 25.0) + (degraded_count * 12.0)
        eq_factors = []
        if offline_count > 0:
            eq_factors.append(f"{offline_count} critical subsystem(s) currently offline or failed")
        if degraded_count > 0:
            eq_factors.append(f"{degraded_count} equipment unit(s) operating in degraded state (<60% health)")
        eq_score = min(100.0, eq_score)
        eq_status = "CRITICAL" if eq_score >= 75 else ("HIGH" if eq_score >= 50 else ("GUARDED" if eq_score >= 30 else "NOMINAL"))

        # Logistics Risk Calculation
        fuel_item = next((i for i in logistics if i.get("category") == "FUEL"), None)
        fuel_days = fuel_item.get("days_remaining", 90.0) if fuel_item else 90.0
        log_score = 10.0
        log_factors = []
        if fuel_days < 15.0:
            log_score += 70.0
            log_factors.append(f"Critical fuel autonomy: only {fuel_days:.1f} days remaining")
        elif fuel_days < 30.0:
            log_score += 40.0
            log_factors.append(f"Guarded fuel reserves ({fuel_days:.1f} days remaining)")
        log_score = min(100.0, log_score)
        log_status = "CRITICAL" if log_score >= 75 else ("HIGH" if log_score >= 50 else ("GUARDED" if log_score >= 30 else "NOMINAL"))

        # Overall Composite Score (weighted average)
        overall_score = round(
            (energy_score * 0.35) + (weather_score * 0.25) + (eq_score * 0.25) + (log_score * 0.15),
            1,
        )
        overall_level = "CRITICAL" if overall_score >= 75 else ("HIGH" if overall_score >= 55 else ("ELEVATED" if overall_score >= 38 else ("GUARDED" if overall_score >= 22 else "NOMINAL")))

        vulnerabilities = []
        mitigations = []
        suggested_commands: List[SuggestedCommand] = []

        if net_kw < -10.0:
            vulnerabilities.append(f"Microgrid shortfall ({abs(net_kw):.1f} kW) draining storage.")
            mitigations.append("Spin up standby diesel generator or shed non-critical research loads.")
            gens = [e for e in equipment if e.get("type") == "GENERATOR" and e.get("status") in ["STANDBY", "NORMAL"]]
            if gens:
                suggested_commands.append(
                    SuggestedCommand(
                        title=f"Start {gens[0].get('name')}",
                        command_type="START_GENERATOR",
                        target_type="EQUIPMENT",
                        target_id=gens[0].get("id"),
                        severity="CRITICAL",
                        rationale=f"Compensates {abs(net_kw):.1f} kW microgrid deficit.",
                    )
                )
            suggested_commands.append(
                SuggestedCommand(
                    title="Shed Non-Critical Loads",
                    command_type="LOAD_SHED",
                    target_type="LOAD_GROUP",
                    parameters={"group_identifier": "NON_CRITICAL"},
                    severity="WARNING",
                    rationale="Reduces station power draw by shedding laboratory/auxiliary loads.",
                )
            )

        if wind_speed > 65.0:
            vulnerabilities.append(f"Extreme winds ({wind_speed:.0f} km/h) threaten outdoor structures and personnel.")
            mitigations.append("Issue blizzard protocol; suspend outdoor EVA excursions.")

        if offline_count > 0:
            for e in [x for x in equipment if x.get("status") in ["OFFLINE", "FAILED"]]:
                vulnerabilities.append(f"Subsystem '{e.get('name')}' is offline.")
                suggested_commands.append(
                    SuggestedCommand(
                        title=f"Schedule Maintenance: {e.get('name')}",
                        command_type="CREATE_MAINTENANCE",
                        target_type="EQUIPMENT",
                        target_id=e.get("id"),
                        severity="WARNING",
                        rationale=f"Diagnose and restore {e.get('name')}.",
                    )
                )

        summary = (
            f"Polaris Digital Twin assesses station operational risk as {overall_level} (Score {overall_score:.1f}/100). "
            + ("All primary subsystems nominal." if overall_score < 25 else f"Key drivers: {'; '.join(energy_factors + weather_factors + eq_factors + log_factors)}.")
        )

        return RiskAssessmentResponse(
            station_id=station.get("id", 1),
            station_code=station.get("code", "BHARATI"),
            station_name=station.get("name", "Bharati Station"),
            overall_score=overall_score,
            risk_level=overall_level,
            summary=summary,
            energy_risk=DomainRiskScore(score=energy_score, status=energy_status, key_factors=energy_factors or ["Microgrid power balance stable"]),
            weather_risk=DomainRiskScore(score=weather_score, status=weather_status, key_factors=weather_factors or ["Atmospheric envelope nominal"]),
            equipment_risk=DomainRiskScore(score=eq_score, status=eq_status, key_factors=eq_factors or ["All primary equipment nominal"]),
            logistics_risk=DomainRiskScore(score=log_score, status=log_status, key_factors=log_factors or ["Reserves above threshold"]),
            vulnerabilities=vulnerabilities or ["No immediate subsystem vulnerabilities identified."],
            immediate_mitigations=mitigations or ["Continue automated monitoring."],
            suggested_commands=suggested_commands,
            telemetry_snapshot=telemetry,
            model_used="polaris-digital-twin-engine",
            provider="deterministic_offline",
        )

    # ------------------------------------------------------------------
    # Public API Methods: Assess Risk, Diagnose, Chat
    # ------------------------------------------------------------------
    async def assess_station_risk(
        self,
        db: Session,
        station_id: int,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> RiskAssessmentResponse:
        """
        Executes a deep multi-subsystem risk assessment using the real LLM
        (Ollama, OpenAI, Gemini) or deterministic engine.
        """
        telemetry = self.harvest_station_telemetry(db, station_id)
        station_name = telemetry.get("station", {}).get("name", "Station")

        system_prompt = (
            "You are Polaris Copilot, an elite AI Operations and Digital Twin Risk Evaluator for Antarctic Research Stations. "
            "You analyze real-time multi-modal telemetry (power generation, battery SOC, weather/wind chill, equipment health scores, "
            "fuel autonomy, and active alerts) to produce rigorous, safety-critical risk assessments.\n"
            "You must return ONLY valid JSON matching this exact structure:\n"
            "{\n"
            '  "overall_score": float (0-100, 0=nominal, 100=disaster),\n'
            '  "risk_level": "NOMINAL" | "GUARDED" | "ELEVATED" | "HIGH" | "CRITICAL",\n'
            '  "summary": "2-3 sentence executive briefing of current station risks and posture.",\n'
            '  "energy_risk": {"score": float, "status": string, "key_factors": ["string"]},\n'
            '  "weather_risk": {"score": float, "status": string, "key_factors": ["string"]},\n'
            '  "equipment_risk": {"score": float, "status": string, "key_factors": ["string"]},\n'
            '  "logistics_risk": {"score": float, "status": string, "key_factors": ["string"]},\n'
            '  "vulnerabilities": ["string"],\n'
            '  "immediate_mitigations": ["string"],\n'
            '  "suggested_commands": [\n'
            '     {"title": "string", "command_type": "START_GENERATOR"|"LOAD_SHED"|"RESTORE_LOAD"|"SET_EMERGENCY_MODE"|"CREATE_MAINTENANCE"|"CREATE_RESUPPLY", "target_type": "EQUIPMENT"|"LOAD_GROUP", "target_id": int|null, "parameters": {}, "severity": "CRITICAL"|"WARNING"|"INFO", "rationale": "string"}\n'
            '  ]\n'
            "}"
        )

        user_prompt = (
            f"Assess the comprehensive operational risk for {station_name}.\n\n"
            f"LIVE TELEMETRY DATA:\n{json.dumps(telemetry, indent=2)}\n\n"
            "Evaluate power balance, battery drawdown, wind chill hazards, degraded equipment, and fuel autonomy."
        )

        raw_response, used_provider, used_model = await self._dispatch_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            provider_override=provider,
            model_override=model,
            json_format=True,
        )

        if raw_response:
            try:
                # Clean JSON markdown fences if model returned them
                cleaned = re.sub(r"^```(?:json)?\s*", "", raw_response.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                data = json.loads(cleaned)

                station_info = telemetry.get("station", {})
                return RiskAssessmentResponse(
                    station_id=station_info.get("id", station_id),
                    station_code=station_info.get("code", "STATION"),
                    station_name=station_info.get("name", "Antarctic Station"),
                    overall_score=float(data.get("overall_score", 15.0)),
                    risk_level=str(data.get("risk_level", "NOMINAL")).upper(),
                    summary=str(data.get("summary", "Station operating within nominal bounds.")),
                    energy_risk=DomainRiskScore(**data.get("energy_risk", {"score": 10.0, "status": "NOMINAL", "key_factors": []})),
                    weather_risk=DomainRiskScore(**data.get("weather_risk", {"score": 10.0, "status": "NOMINAL", "key_factors": []})),
                    equipment_risk=DomainRiskScore(**data.get("equipment_risk", {"score": 10.0, "status": "NOMINAL", "key_factors": []})),
                    logistics_risk=DomainRiskScore(**data.get("logistics_risk", {"score": 10.0, "status": "NOMINAL", "key_factors": []})),
                    vulnerabilities=data.get("vulnerabilities", []),
                    immediate_mitigations=data.get("immediate_mitigations", []),
                    suggested_commands=[SuggestedCommand(**c) for c in data.get("suggested_commands", []) if isinstance(c, dict)],
                    telemetry_snapshot=telemetry,
                    model_used=used_model,
                    provider=used_provider,
                )
            except Exception as e:
                logger.warning("Failed to parse LLM JSON response for risk assessment: %s. Falling back.", e)

        # Graceful fallback to deterministic engine
        return self._deterministic_risk_assessment(telemetry)

    async def diagnose_station(
        self,
        db: Session,
        station_id: int,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> DiagnosticResponse:
        """
        Synthesizes live station telemetry into a human-grade diagnostic and actionable recommendations.
        """
        telemetry = self.harvest_station_telemetry(db, station_id)
        station_name = telemetry.get("station", {}).get("name", "Station")

        system_prompt = (
            "You are Polaris Copilot, the AI Operations Diagnosis system for Antarctic Research Stations. "
            "Synthesize current telemetry into a clear diagnostic summary and ranked operational recommendations.\n"
            "Return ONLY valid JSON matching this schema:\n"
            "{\n"
            '  "diagnostic_summary": "1-2 concise sentences summarizing station envelope status and anomalies.",\n'
            '  "subsystems_status": {"Power Generation": "NOMINAL"|"DEGRADED"|"CRITICAL", "Life Support": "NOMINAL", "Logistics": "NOMINAL", "HVAC / Thermal": "NOMINAL"},\n'
            '  "recommendations": [\n'
            '     {"id": 1, "station_id": int, "severity": "CRITICAL"|"WARNING"|"INFO", "category": "ENERGY"|"EQUIPMENT"|"WEATHER"|"LOGISTICS", "title": "string", "explanation": "string", "suggested_action": "string", "target_command_type": "START_GENERATOR"|"LOAD_SHED"|"RESTORE_LOAD"|"SET_EMERGENCY_MODE"|"CREATE_MAINTENANCE"|"CREATE_RESUPPLY"|null, "target_equipment_id": int|null, "status": "ACTIVE"}\n'
            '  ]\n'
            "}"
        )

        user_prompt = (
            f"Diagnose station health and produce ranked recommendations for {station_name}.\n\n"
            f"LIVE TELEMETRY:\n{json.dumps(telemetry, indent=2)}"
        )

        raw_response, used_provider, used_model = await self._dispatch_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            provider_override=provider,
            model_override=model,
            json_format=True,
        )

        if raw_response:
            try:
                cleaned = re.sub(r"^```(?:json)?\s*", "", raw_response.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                data = json.loads(cleaned)

                recs = []
                now = datetime.now(timezone.utc)
                for idx, r in enumerate(data.get("recommendations", [])):
                    recs.append(
                        OperationalRecommendationOut(
                            id=idx + 1,
                            station_id=station_id,
                            severity=r.get("severity", "INFO"),
                            category=r.get("category", "OPERATIONS"),
                            title=r.get("title", "Operational Advisory"),
                            explanation=r.get("explanation", ""),
                            suggested_action=r.get("suggested_action", ""),
                            target_command_type=r.get("target_command_type"),
                            target_equipment_id=r.get("target_equipment_id"),
                            status="ACTIVE",
                            created_at=now,
                            expires_at=now + timedelta(hours=4),
                        )
                    )

                return DiagnosticResponse(
                    station_id=station_id,
                    station_name=station_name,
                    diagnostic_summary=data.get("diagnostic_summary", "All subsystems within nominal envelope. No anomalies detected."),
                    subsystems_status=data.get("subsystems_status", {"Microgrid": "NOMINAL", "Life Support": "NOMINAL"}),
                    active_anomalies_count=len(telemetry.get("active_alerts", [])),
                    recommendations=recs,
                    model_used=used_model,
                    provider=used_provider,
                )
            except Exception as e:
                logger.warning("Failed to parse LLM diagnosis response: %s", e)

        # Deterministic fallback diagnosis
        energy = telemetry.get("energy", {})
        env = telemetry.get("environment", {})
        eq_list = telemetry.get("equipment", [])
        offline_eq = [e for e in eq_list if e.get("status") in ["OFFLINE", "FAILED"]]

        diag_parts = []
        if offline_eq:
            diag_parts.append(f"{', '.join([e.get('name') for e in offline_eq])} offline")
        if energy.get("energy_balance_kw", 0.0) < 0:
            diag_parts.append(f"energy deficit {abs(energy.get('energy_balance_kw')):.1f} kW (battery discharging)")
        if env.get("wind_speed_kmh", 0) > 65:
            diag_parts.append(f"blizzard alert ({env.get('wind_speed_kmh'):.0f} km/h winds, wind chill {env.get('wind_chill_c'):.0f}°C)")

        diag_text = (
            f"{'; '.join(diag_parts)}." if diag_parts else "All subsystems within nominal envelope. No anomalies detected."
        )

        # Generate fallback recommendations
        from app.services.operations_service import operations_service
        raw_recs = operations_service.generate_recommendations(db, station_id)
        formatted_recs = [
            OperationalRecommendationOut(
                id=i + 1,
                station_id=station_id,
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
            )
            for i, r in enumerate(raw_recs)
        ]

        return DiagnosticResponse(
            station_id=station_id,
            station_name=station_name,
            diagnostic_summary=diag_text,
            subsystems_status={
                "Microgrid Power": "DEGRADED" if energy.get("energy_balance_kw", 0) < -10 else "NOMINAL",
                "Atmospheric Envelope": "CRITICAL" if env.get("wind_speed_kmh", 0) > 80 else "NOMINAL",
                "Subsystem Assets": "DEGRADED" if offline_eq else "NOMINAL",
            },
            active_anomalies_count=len(telemetry.get("active_alerts", [])),
            recommendations=formatted_recs,
            model_used="polaris-digital-twin-engine",
            provider="deterministic_offline",
        )

    async def chat(
        self,
        db: Session,
        station_id: int,
        message: str,
        history: Optional[List[ChatMessage]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> CopilotChatResponse:
        """
        Interactive conversational AI Copilot. Operators can ask questions about power,
        weather, EVA safety, equipment degradation, logistics, or command execution.
        """
        telemetry = self.harvest_station_telemetry(db, station_id)
        station_name = telemetry.get("station", {}).get("name", "Bharati Station")

        system_prompt = (
            f"You are Polaris Copilot, the AI Operations and Decision Intelligence Engine for {station_name} in Antarctica. "
            "You have direct access to the live digital twin telemetry stream (energy microgrid, weather sensors, equipment health scores, "
            "logistics reserves, and active alarms). "
            "Your role is to assist human operators in maintaining station safety, power stability, and mission readiness.\n\n"
            "GUIDELINES:\n"
            "1. Ground all answers in the provided live telemetry numbers (wind speed, temperature, generation kW, battery %, fuel autonomy).\n"
            "2. When assessing safety or risk, calculate specific physical constraints (e.g. wind chill, battery discharge hours, fuel burn rate).\n"
            "3. If an action is required (e.g., starting a generator, shedding load, creating maintenance), recommend the specific command.\n"
            "4. Format responses clearly with concise markdown bullet points and highlighted telemetry values.\n"
            "5. Return ONLY valid JSON with this format:\n"
            "{\n"
            '  "answer": "Your comprehensive, analytical markdown answer.",\n'
            '  "risk_level": "NOMINAL" | "GUARDED" | "ELEVATED" | "HIGH" | "CRITICAL",\n'
            '  "risk_score": float (0-100),\n'
            '  "cited_telemetry": {"wind_speed": "...", "energy_balance": "...", "battery_soc": "...", "fuel_days": "..."},\n'
            '  "suggested_actions": [\n'
            '     {"title": "string", "command_type": "START_GENERATOR"|"LOAD_SHED"|"RESTORE_LOAD"|"SET_EMERGENCY_MODE"|"CREATE_MAINTENANCE"|"CREATE_RESUPPLY", "target_type": "EQUIPMENT"|"LOAD_GROUP", "target_id": int|null, "parameters": {}, "severity": "CRITICAL"|"WARNING"|"INFO", "rationale": "string"}\n'
            '  ]\n'
            "}"
        )

        user_prompt = (
            f"OPERATOR QUERY: {message}\n\n"
            f"LIVE STATION TELEMETRY:\n{json.dumps(telemetry, indent=2)}"
        )

        raw_response, used_provider, used_model = await self._dispatch_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            provider_override=provider,
            model_override=model,
            history=history,
            json_format=True,
        )

        if raw_response:
            try:
                cleaned = re.sub(r"^```(?:json)?\s*", "", raw_response.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                data = json.loads(cleaned)

                actions = [
                    SuggestedCommand(**a)
                    for a in data.get("suggested_actions", [])
                    if isinstance(a, dict)
                ]

                return CopilotChatResponse(
                    answer=data.get("answer", raw_response),
                    risk_level=str(data.get("risk_level", "NOMINAL")).upper(),
                    risk_score=float(data.get("risk_score", 10.0)),
                    cited_telemetry=data.get("cited_telemetry", {}),
                    suggested_actions=actions,
                    model_used=used_model,
                    provider=used_provider,
                )
            except Exception as e:
                logger.warning("Could not parse chat JSON from LLM: %s. Returning raw text as answer.", e)
                return CopilotChatResponse(
                    answer=raw_response,
                    risk_level="NOMINAL",
                    risk_score=15.0,
                    cited_telemetry={"station": station_name},
                    suggested_actions=[],
                    model_used=used_model,
                    provider=used_provider,
                )

        # Deterministic chat fallback
        q_upper = message.upper()
        energy = telemetry.get("energy", {})
        env = telemetry.get("environment", {})
        equipment = telemetry.get("equipment", [])
        logistics = telemetry.get("logistics", [])

        if "RISK" in q_upper:
            risk_res = self._deterministic_risk_assessment(telemetry)
            return CopilotChatResponse(
                answer=(
                    f"**Station Risk Assessment ({risk_res.risk_level} — Score {risk_res.overall_score}/100)**\n\n"
                    f"{risk_res.summary}\n\n"
                    f"**Subsystem Breakdown:**\n"
                    f"- **Energy Microgrid**: {risk_res.energy_risk.status} ({risk_res.energy_risk.score}/100) — {', '.join(risk_res.energy_risk.key_factors)}\n"
                    f"- **Atmospheric / Weather**: {risk_res.weather_risk.status} ({risk_res.weather_risk.score}/100) — {', '.join(risk_res.weather_risk.key_factors)}\n"
                    f"- **Equipment Health**: {risk_res.equipment_risk.status} ({risk_res.equipment_risk.score}/100) — {', '.join(risk_res.equipment_risk.key_factors)}\n"
                    f"- **Logistics Reserves**: {risk_res.logistics_risk.status} ({risk_res.logistics_risk.score}/100) — {', '.join(risk_res.logistics_risk.key_factors)}"
                ),
                risk_level=risk_res.risk_level,
                risk_score=risk_res.overall_score,
                cited_telemetry={"net_energy": f"{energy.get('energy_balance_kw')} kW", "wind": f"{env.get('wind_speed_kmh')} km/h"},
                suggested_actions=risk_res.suggested_commands,
                model_used="polaris-digital-twin-engine",
                provider="deterministic_offline",
            )
        elif "ENERGY" in q_upper or "POWER" in q_upper or "DEFICIT" in q_upper:
            net_kw = energy.get("energy_balance_kw", 0.0)
            battery_soc = energy.get("battery_percentage", 100.0)
            flow_kw = energy.get("battery_power_kw", 0.0)
            return CopilotChatResponse(
                answer=(
                    f"**Microgrid Power Diagnostic:**\n\n"
                    f"- **Generation**: {energy.get('generation_kw', 0):.1f} kW (Solar: {energy.get('solar_kw', 0):.1f} kW, Wind: {energy.get('wind_kw', 0):.1f} kW, Diesel: {energy.get('diesel_kw', 0):.1f} kW)\n"
                    f"- **Station Demand**: {energy.get('consumption_kw', 0):.1f} kW\n"
                    f"- **Net Balance**: **{net_kw:+.1f} kW**\n"
                    f"- **Battery Storage**: {battery_soc:.0f}% ({flow_kw:+.1f} kW flow)\n\n"
                    + (
                        f"⚠️ **Warning**: Net power deficit of {abs(net_kw):.1f} kW is discharging storage. Recommend starting standby generator or shedding auxiliary loads."
                        if net_kw < 0
                        else "✅ **Status**: Generation exceeds demand. Storage bank stable."
                    )
                ),
                risk_level="GUARDED" if net_kw < -5.0 else "NOMINAL",
                risk_score=40.0 if net_kw < -5.0 else 10.0,
                cited_telemetry=energy,
                suggested_actions=[
                    SuggestedCommand(
                        title="Shed Non-Critical Loads",
                        command_type="LOAD_SHED",
                        target_type="LOAD_GROUP",
                        parameters={"group_identifier": "NON_CRITICAL"},
                        severity="WARNING",
                        rationale="Balances microgrid by removing laboratory loads.",
                    )
                ] if net_kw < -5.0 else [],
                model_used="polaris-digital-twin-engine",
                provider="deterministic_offline",
            )
        elif "OUTDOOR" in q_upper or "EVA" in q_upper or "WEATHER" in q_upper or "SAFETY" in q_upper:
            wind = env.get("wind_speed_kmh", 0)
            chill = env.get("wind_chill_c", -20)
            temp = env.get("outdoor_temp_c", -20)
            safe = wind < 50.0 and chill > -38.0
            return CopilotChatResponse(
                answer=(
                    f"**Outdoor EVA & Safety Evaluation:**\n\n"
                    f"- **Outdoor Temp**: {temp:.1f}°C\n"
                    f"- **Wind Speed**: {wind:.0f} km/h (Direction: {env.get('wind_direction_deg', 0):.0f}°)\n"
                    f"- **Calculated Wind Chill**: **{chill:.1f}°C**\n"
                    f"- **Blizzard Hazard**: {env.get('blizzard_risk', 'LOW')}\n\n"
                    + (
                        "✅ **EVA Permitted**: Atmospheric envelope is within safe operational thresholds. Standard cold-weather PPE required."
                        if safe
                        else f"⛔ **EVA Prohibited**: Severe conditions ({wind:.0f} km/h winds, wind chill {chill:.1f}°C). Risk of frostbite in <10 minutes."
                    )
                ),
                risk_level="NOMINAL" if safe else "HIGH",
                risk_score=10.0 if safe else 70.0,
                cited_telemetry=env,
                suggested_actions=[],
                model_used="polaris-digital-twin-engine",
                provider="deterministic_offline",
            )
        else:
            return CopilotChatResponse(
                answer=(
                    f"**Polaris AI Copilot ({station_name})**\n\n"
                    f"Station systems are currently monitored in real time.\n"
                    f"- **Net Microgrid**: {energy.get('energy_balance_kw', 0):+.1f} kW\n"
                    f"- **Atmosphere**: {env.get('outdoor_temp_c', -20):.1f}°C, Wind {env.get('wind_speed_kmh', 0):.0f} km/h (Chill {env.get('wind_chill_c', -20):.0f}°C)\n"
                    f"- **Battery Reserve**: {energy.get('battery_percentage', 100):.0f}%\n"
                    f"- **Active Alerts**: {len(telemetry.get('active_alerts', []))}\n\n"
                    f"You can ask me to evaluate station risk, analyze energy deficits, audit logistics reserves, or simulate maintenance interventions."
                ),
                risk_level="NOMINAL",
                risk_score=10.0,
                cited_telemetry={"station": station_name},
                suggested_actions=[],
                model_used="polaris-digital-twin-engine",
                provider="deterministic_offline",
            )


llm_copilot_service = LLMCopilotService()
