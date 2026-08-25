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
    
    # Security
    SECRET_KEY: str = "polar-digital-twin-hackathon-super-secret-key-2026"
    
    # Simulation Engine
    SIMULATION_ENABLED: bool = True
    SIMULATION_INTERVAL_SECONDS: int = 10
    
    # Alert Thresholds (Configurable)
    BATTERY_CRITICAL_THRESHOLD: float = 10.0
    BATTERY_WARNING_THRESHOLD: float = 20.0
    FUEL_CRITICAL_THRESHOLD: float = 10.0
    FUEL_WARNING_THRESHOLD: float = 20.0
    EQUIPMENT_HEALTH_CRITICAL: float = 30.0
    EQUIPMENT_HEALTH_WARNING: float = 60.0
    LOGISTICS_CRITICAL_DAYS: float = 15.0
    LOGISTICS_WARNING_DAYS: float = 30.0
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

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
