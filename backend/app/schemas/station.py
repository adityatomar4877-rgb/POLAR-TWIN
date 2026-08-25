from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class StationBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Bharati Research Station"})
    code: str = Field(..., json_schema_extra={"example": "BHARATI"})
    latitude: float = Field(..., ge=-90.0, le=90.0, json_schema_extra={"example": -69.407})
    longitude: float = Field(..., ge=-180.0, le=180.0, json_schema_extra={"example": 76.192})
    elevation: float = Field(..., json_schema_extra={"example": 35.0})
    status: str = Field(default="OPERATIONAL", json_schema_extra={"example": "OPERATIONAL"})
    description: Optional[str] = Field(None, json_schema_extra={"example": "Indian Antarctic research facility in Larsemann Hills."})


class StationCreate(StationBase):
    pass


class StationUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None


class StationOut(StationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
