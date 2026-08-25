from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from app.schemas.station import StationOut
from app.schemas.sensor import SensorTelemetryOut
from app.schemas.energy import EnergyTelemetryOut
from app.schemas.equipment import EquipmentOut
from app.schemas.logistics import LogisticsItemOut
from app.schemas.alert import AlertOut
from app.schemas.prediction import EnergyForecastResponse, FuelDepletionForecastResponse


class StationDashboardOut(BaseModel):
    station: StationOut
    environment: Optional[SensorTelemetryOut]
    energy: Optional[EnergyTelemetryOut]
    equipment: List[EquipmentOut]
    logistics: List[LogisticsItemOut]
    alerts: List[AlertOut]
    predictions: Dict[str, Any]
    simulation: Dict[str, Any]
    operations: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[Dict[str, Any]]] = None
    maintenance_summary: Optional[Dict[str, Any]] = None
    resupply_summary: Optional[Dict[str, Any]] = None
    loads: Optional[List[Dict[str, Any]]] = None
