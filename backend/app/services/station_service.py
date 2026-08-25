from typing import List, Optional, Union
from sqlalchemy.orm import Session
from app.models.station import Station
from app.core.security import APIError


class StationService:
    @staticmethod
    def get_all_stations(db: Session) -> List[Station]:
        return db.query(Station).order_by(Station.id.asc()).all()

    @staticmethod
    def get_station_by_id_or_code(db: Session, identifier: Union[int, str]) -> Station:
        """Looks up a station by integer ID or case-insensitive code/name ('MAITRI', 'BHARATI')."""
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            station = db.query(Station).filter(Station.id == int(identifier)).first()
        else:
            code_upper = str(identifier).strip().upper()
            # Support common aliases/spelling variations
            if code_upper in ["BHARTI", "BHARATHI"]:
                code_upper = "BHARATI"
            elif code_upper in ["MAITREE", "METRI"]:
                code_upper = "MAITRI"

            station = db.query(Station).filter(Station.code.ilike(code_upper)).first()
            if not station:
                station = db.query(Station).filter(Station.name.ilike(f"%{identifier}%")).first()

        if not station:
            raise APIError(
                code="STATION_NOT_FOUND",
                message=f"Station '{identifier}' was not found in the Digital Twin system.",
                status_code=404,
            )
        return station

    @staticmethod
    def create_station(db: Session, name: str, code: str, lat: float, lon: float, elevation: float, description: str = "") -> Station:
        station = Station(
            name=name,
            code=code.upper(),
            latitude=lat,
            longitude=lon,
            elevation=elevation,
            description=description,
            status="OPERATIONAL",
        )
        db.add(station)
        db.commit()
        db.refresh(station)
        return station


station_service = StationService()
