import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.station import Station
from app.models.equipment import Equipment
from app.models.logistics import LogisticsItem
from app.models.sensor import SensorTelemetry
from app.models.energy import EnergyTelemetry
from app.models.alert import Alert

# In-memory SQLite engine for fast, isolated test execution
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Seed baseline test data
    now = datetime.now(timezone.utc)
    maitri = Station(
        name="Maitri Research Station",
        code="MAITRI",
        latitude=-70.767,
        longitude=11.733,
        elevation=117.0,
        status="OPERATIONAL",
        description="Maitri station test facility.",
    )
    bharati = Station(
        name="Bharati Research Station",
        code="BHARATI",
        latitude=-69.407,
        longitude=76.192,
        elevation=35.0,
        status="OPERATIONAL",
        description="Bharati station test facility.",
    )
    session.add_all([maitri, bharati])
    session.commit()
    session.refresh(maitri)
    session.refresh(bharati)

    # Equipment
    for st in [maitri, bharati]:
        for eq_name, eq_type in [
            ("Generator 1", "GENERATOR"),
            ("Generator 2", "GENERATOR"),
            ("Battery Bank", "BATTERY_BANK"),
            ("HVAC System", "HVAC"),
            ("Water Treatment System", "WATER_TREATMENT"),
            ("Communications System", "COMMUNICATIONS"),
            ("Solar Array", "SOLAR_ARRAY"),
        ]:
            session.add(
                Equipment(
                    station_id=st.id,
                    name=eq_name,
                    equipment_type=eq_type,
                    status="NORMAL",
                    health_score=95.0,
                    temperature=68.0 if eq_type == "GENERATOR" else 22.0,
                    runtime_hours=1200.0,
                    efficiency=94.0,
                    last_maintenance=now - timedelta(days=30),
                    next_maintenance=now + timedelta(days=150),
                )
            )

        # Logistics
        session.add(
            LogisticsItem(
                station_id=st.id,
                item_name="Arctic Diesel Fuel",
                category="FUEL",
                quantity=50000.0,
                unit="liters",
                daily_consumption=1000.0,
                minimum_threshold=10000.0,
                days_remaining=50.0,
                status="NORMAL",
            )
        )
        session.add(
            LogisticsItem(
                station_id=st.id,
                item_name="Emergency Rations",
                category="FOOD",
                quantity=6000.0,
                unit="kg",
                daily_consumption=40.0,
                minimum_threshold=1000.0,
                days_remaining=150.0,
                status="NORMAL",
            )
        )

        # Historical Telemetry (30 records)
        import math
        for i in range(30, 0, -1):
            t = now - timedelta(hours=i)
            session.add(
                SensorTelemetry(
                    station_id=st.id,
                    timestamp=t,
                    temperature=round(-20.0 + 4.0 * math.cos(i / 12.0 * math.pi), 1),
                    wind_speed=round(35.0 + 5.0 * math.sin(i / 6.0 * math.pi), 1),
                    wind_direction=170.0,
                    pressure=990.0,
                    humidity=65.0,
                    precipitation=0.0,
                    visibility=10.0,
                    source="test_sim",
                    is_simulated=True,
                )
            )
            session.add(
                EnergyTelemetry(
                    station_id=st.id,
                    timestamp=t,
                    generation_kw=160.0,
                    consumption_kw=130.0,
                    energy_balance=30.0,
                    battery_percentage=85.0,
                    battery_power_kw=10.0,
                    diesel_generation_kw=120.0,
                    solar_generation_kw=40.0,
                    fuel_percentage=75.0,
                    grid_status="ONLINE",
                    source="test_sim",
                    is_simulated=True,
                )
            )

        # Sample Alert
        session.add(
            Alert(
                station_id=st.id,
                alert_type="SYSTEM",
                severity="INFO",
                title="Telemetry Initialized",
                message="Digital twin online.",
                source="TestRunner",
                acknowledged=False,
            )
        )

        # Load Groups
        from app.models.audit import LoadGroup
        for name, cat, power, prio, enabled, shedable in [
            ("Life Support & Air Handling", "CRITICAL", 35.0, 1, True, False),
            ("Primary HVAC Thermal Loop", "CRITICAL", 30.0, 1, True, False),
            ("Desalination & Water Distribution", "CRITICAL", 12.0, 2, True, False),
            ("Satellite Comms & Telemetry", "CRITICAL", 6.0, 1, True, False),
            ("Deep Ice Core Lab & Freezers", "HIGH_PRIORITY", 16.0, 3, True, True),
            ("Atmospheric LIDAR & Radar", "HIGH_PRIORITY", 14.0, 3, True, True),
            ("Living Quarters & Galley Lighting", "NON_CRITICAL", 9.0, 4, True, True),
            ("Recreation & Sauna Module", "NON_CRITICAL", 12.0, 5, True, True),
            ("Auxiliary Workshop Tools", "NON_CRITICAL", 8.0, 5, True, True),
        ]:
            session.add(
                LoadGroup(
                    station_id=st.id,
                    name=name,
                    category=cat,
                    current_power_kw=power,
                    priority=prio,
                    enabled=enabled,
                    shedable=shedable,
                )
            )

    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
