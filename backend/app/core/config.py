import warnings
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json


class Settings(BaseSettings):
    PROJECT_NAME: str = "POLAR-TWIN"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "sqlite:///./polar_twin.db"
    
    # Weather Service
    WEATHER_API_KEY: str = ""
    WEATHER_API_URL: str = "https://api.open-meteo.com/v1/forecast"
    WEATHER_CACHE_TTL_SECONDS: int = 900  # 15 minutes
    WEATHER_API_TIMEOUT_SECONDS: float = 4.0
    
    # Security
    SECRET_KEY: str = ""
    
    # Simulation Engine
    SIMULATION_ENABLED: bool = True
    SIMULATION_INTERVAL_SECONDS: int = 10
    
    # Alert Thresholds — Energy & Fuel
    BATTERY_CRITICAL_THRESHOLD: float = 10.0
    BATTERY_WARNING_THRESHOLD: float = 20.0
    FUEL_CRITICAL_THRESHOLD: float = 10.0
    FUEL_WARNING_THRESHOLD: float = 20.0
    EQUIPMENT_HEALTH_CRITICAL: float = 30.0
    EQUIPMENT_HEALTH_WARNING: float = 60.0
    LOGISTICS_CRITICAL_DAYS: float = 15.0
    LOGISTICS_WARNING_DAYS: float = 30.0
    
    # Alert Thresholds — Weather & Environment
    WIND_CRITICAL_THRESHOLD: float = 90.0
    WIND_WARNING_THRESHOLD: float = 65.0
    TEMP_EXTREME_THRESHOLD: float = -42.0
    
    # Alert Thresholds — Energy Deficit
    ENERGY_DEFICIT_ALERT_KW: float = -20.0
    ENERGY_DEFICIT_BATTERY_THRESHOLD: float = 30.0
    
    # Alert Deduplication
    ALERT_DEDUP_WINDOW_MINUTES: int = 15
    
    # LLM & AI Operations Copilot Configuration
    # Supported providers: 'ollama', 'openai', 'gemini', 'groq', 'auto'
    LLM_PROVIDER: str = "auto"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    LLM_TEMPERATURE: float = 0.2
    LLM_TIMEOUT_SECONDS: float = 30.0
    
    # Default Operator Identity (used when no auth system is present)
    DEFAULT_OPERATOR_ID: str = "Operator_Demo"
    DEFAULT_OPERATOR_ROLE: str = "OPERATOR"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        insecure_default = "polar-digital-twin-hackathon-super-secret-key-2026"
        if not v or v == insecure_default:
            warnings.warn(
                "SECRET_KEY is using an insecure default. "
                "Set a strong SECRET_KEY in .env for production.",
                stacklevel=2,
            )
            return v or insecure_default
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
