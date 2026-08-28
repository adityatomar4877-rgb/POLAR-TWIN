import math
import random
from datetime import datetime, timedelta, timezone
from app.core.database import SessionLocal, init_db
from app.models.station import Station
from app.models.equipment import Equipment
from app.models.logistics import LogisticsItem
from app.models.sensor import SensorTelemetry
from app.models.energy import EnergyTelemetry
from app.models.alert import Alert
from app.utils.calculations import calculate_days_remaining, calculate_energy_balance


def seed_database():
    print("Initializing database tables...")
    init_db()
    db = SessionLocal()

    try:
        existing_count = db.query(Station).count()
        if existing_count > 0:
            print("Database already seeded with stations. Resetting and re-seeding demo dataset...")
            from app.models.audit import AuditLog, LoadGroup, OperationalRecommendation
            from app.models.command import Command
            from app.models.maintenance import MaintenanceTask, ResupplyRequest

            db.query(AuditLog).delete()
            db.query(OperationalRecommendation).delete()
            db.query(Command).delete()
            db.query(MaintenanceTask).delete()
            db.query(ResupplyRequest).delete()
            db.query(LoadGroup).delete()
            db.query(Alert).delete()
            db.query(EnergyTelemetry).delete()
            db.query(SensorTelemetry).delete()
            db.query(LogisticsItem).delete()
            db.query(Equipment).delete()
            db.query(Station).delete()
            db.commit()

        print("Seeding research stations: Maitri and Bharati...")
        now = datetime.now(timezone.utc)

        maitri = Station(
            name="Maitri Research Station",
            code="MAITRI",
            latitude=-70.767,
            longitude=11.733,
            elevation=117.0,
            status="OPERATIONAL",
            description="India's second permanent research station in Antarctica, established in 1989 at Schirmacher Oasis in Queen Maud Land. Operating year-round for atmospheric, meteorological, and earth sciences.",
            created_at=now - timedelta(days=365),
            updated_at=now,
        )

        bharati = Station(
            name="Bharati Research Station",
            code="BHARATI",
            latitude=-69.407,
            longitude=76.192,
            elevation=35.0,
            status="OPERATIONAL",
            description="India's third modern Antarctic research facility, operational since 2012 in Larsemann Hills, East Antarctica. Features advanced modular energy-efficient building systems and satellite telemetry.",
            created_at=now - timedelta(days=365),
            updated_at=now,
        )

        db.add_all([maitri, bharati])
        db.commit()
        db.refresh(maitri)
        db.refresh(bharati)

        stations = [maitri, bharati]

        # Seed Equipment
        print("Seeding infrastructure equipment for each station...")
        equipment_configs = [
            ("Generator 1", "GENERATOR", 72.0, 95.0, 94.0, 2400.0, 45, 135),
            ("Generator 2", "GENERATOR", 25.0, 98.0, 96.0, 1150.0, 30, 150),
            ("Battery Bank", "BATTERY_BANK", 21.0, 96.0, 95.0, 8760.0, 60, 120),
            ("HVAC System", "HVAC", 42.0, 92.0, 91.0, 4380.0, 40, 140),
            ("Water Treatment System", "WATER_TREATMENT", 24.0, 97.0, 96.0, 3200.0, 50, 130),
            ("Communications System", "COMMUNICATIONS", 28.0, 99.0, 98.0, 8760.0, 20, 160),
            ("Solar Array", "SOLAR_ARRAY", -5.0, 94.0, 92.0, 5200.0, 90, 90),
            ("Wind Turbine", "WIND_TURBINE", -10.0, 93.0, 91.0, 3800.0, 75, 105),
        ]

        for st in stations:
            for name, eq_type, temp, health, eff, runtime, days_since_maint, days_to_next in equipment_configs:
                eq = Equipment(
                    station_id=st.id,
                    name=name,
                    equipment_type=eq_type,
                    status="NORMAL",
                    health_score=health,
                    temperature=temp,
                    runtime_hours=runtime,
                    efficiency=eff,
                    last_maintenance=now - timedelta(days=days_since_maint),
                    next_maintenance=now + timedelta(days=days_to_next),
                    created_at=now - timedelta(days=365),
                    updated_at=now,
                )
                db.add(eq)

        # Seed Logistics
        print("Seeding logistics supplies and inventory...")
        logistics_data = [
            # Maitri
            (maitri.id, "Arctic Diesel Fuel (SAB)", "FUEL", 58500.0, "liters", 1250.0, 10000.0),
            (maitri.id, "Emergency Freeze-Dried Rations", "FOOD", 7800.0, "kg", 42.0, 1200.0),
            (maitri.id, "Medical Trauma & Life Support Kits", "MEDICAL", 110.0, "kits", 0.35, 20.0),
            (maitri.id, "Microgrid Replacement Parts & Filters", "SPARE_PARTS", 380.0, "units", 1.1, 60.0),
            (maitri.id, "Priyadarshini Lake Reserve Water", "WATER", 42000.0, "liters", 950.0, 6000.0),
            # Bharati
            (bharati.id, "Arctic Diesel Fuel (SAB)", "FUEL", 49200.0, "liters", 1100.0, 8000.0),
            (bharati.id, "Expedition Rations & Perishables", "FOOD", 6900.0, "kg", 38.0, 1000.0),
            (bharati.id, "Medical Emergency Supplies", "MEDICAL", 95.0, "kits", 0.30, 15.0),
            (bharati.id, "Turbine & Generator Spares", "SPARE_PARTS", 420.0, "units", 0.9, 50.0),
            (bharati.id, "Desalination Potable Water", "WATER", 31000.0, "liters", 820.0, 5000.0),
        ]

        for st_id, item_name, cat, qty, unit, burn, min_thresh in logistics_data:
            days_rem = calculate_days_remaining(qty, burn)
            status = "NORMAL" if days_rem > 30 else ("WARNING" if days_rem >= 15 else "CRITICAL")
            item = LogisticsItem(
                station_id=st_id,
                item_name=item_name,
                category=cat,
                quantity=qty,
                unit=unit,
                daily_consumption=burn,
                minimum_threshold=min_thresh,
                days_remaining=days_rem,
                status=status,
                updated_at=now,
            )
            db.add(item)

        # Seed 7 Days of Realistic Historical Telemetry (168 hourly data points per station)
        print("Generating 7 days (168 hours) of historical environmental and energy telemetry...")
        random.seed(42) # Deterministic seeding

        for st in stations:
            is_maitri = (st.code == "MAITRI")
            base_temp_center = -22.0 if is_maitri else -16.0
            fuel_level = 88.0 # starting fuel 7 days ago
            battery_level = 85.0

            for hour_offset in range(168, -1, -1):
                t_point = now - timedelta(hours=hour_offset)
                hour_val = t_point.hour

                # Diurnal temperature cycle
                diurnal_temp = 4.0 * math.cos((hour_val - 14) / 24.0 * 2 * math.pi)
                temp = round(base_temp_center + diurnal_temp + random.uniform(-1.5, 1.5), 1)

                # Wind patterns
                wind_base = 38.0 if is_maitri else 30.0
                wind = round(max(10.0, wind_base + 8.0 * math.sin(hour_offset / 12.0) + random.uniform(-5.0, 5.0)), 1)
                pressure = round((985.0 if is_maitri else 992.0) + 5.0 * math.cos(hour_offset / 24.0) + random.uniform(-1.0, 1.0), 1)
                humidity = round(max(35.0, min(85.0, 62.0 + random.uniform(-8.0, 8.0))), 1)

                # Solar irradiance from hour of day
                if 7 <= hour_val <= 17:
                    solar_irr = round(max(0.0, 1000.0 * (math.sin((hour_val - 7) / 10.0 * math.pi) ** 1.2)), 1)
                else:
                    solar_irr = 0.0

                sensor_rec = SensorTelemetry(
                    station_id=st.id,
                    timestamp=t_point,
                    temperature=temp,
                    wind_speed=wind,
                    wind_direction=round((165.0 + random.uniform(-20.0, 20.0)) % 360, 1),
                    pressure=pressure,
                    humidity=humidity,
                    precipitation=0.0 if humidity < 75.0 else round(random.uniform(0.1, 0.5), 1),
                    visibility=10.0 if wind < 55.0 else 4.5,
                    solar_irradiance_wm2=solar_irr,
                    source="historical_record",
                    is_simulated=True,
                )
                db.add(sensor_rec)

                # Energy calculations for this hour
                base_load = 92.0 if is_maitri else 82.0
                heating_load = max(0.0, -1.0 * temp * 1.5) + (wind / 50.0) * 5.0
                consumption = round(base_load + heating_load + random.uniform(-2.0, 2.0), 1)

                # Solar power during daytime hours
                if 7 <= hour_val <= 17:
                    solar_factor = math.sin((hour_val - 7) / 10.0 * math.pi)
                    solar_kw = round((50.0 if not is_maitri else 35.0) * solar_factor + random.uniform(-2.0, 2.0), 1)
                    solar_kw = max(0.0, solar_kw)
                else:
                    solar_kw = 0.0

                # Wind turbine power (cubic ramp: cut-in 12 km/h, rated 45 km/h)
                if wind >= 12.0 and wind <= 90.0:
                    if wind < 45.0:
                        wind_kw = round(45.0 * ((wind - 12.0) / 33.0) ** 3, 1)
                    else:
                        wind_kw = round(45.0 + random.uniform(-1.0, 1.0), 1)
                else:
                    wind_kw = 0.0

                diesel_needed = max(0.0, consumption - solar_kw - wind_kw + 5.0)
                diesel_kw = round(min(120.0, diesel_needed), 1)
                generation = round(solar_kw + diesel_kw + wind_kw, 1)
                balance = calculate_energy_balance(generation, consumption)

                # Battery and fuel decrement
                battery_power = balance
                battery_level = max(60.0, min(98.0, battery_level + (balance * 0.05)))
                fuel_decrement = (diesel_kw / 120.0) * 0.07
                fuel_level = max(40.0, fuel_level - fuel_decrement)

                energy_rec = EnergyTelemetry(
                    station_id=st.id,
                    timestamp=t_point,
                    generation_kw=generation,
                    consumption_kw=consumption,
                    energy_balance=balance,
                    battery_percentage=round(battery_level, 1),
                    battery_power_kw=round(battery_power, 1),
                    diesel_generation_kw=diesel_kw,
                    solar_generation_kw=solar_kw,
                    wind_generation_kw=wind_kw,
                    fuel_percentage=round(fuel_level, 1),
                    grid_status="ONLINE",
                    source="historical_record",
                    is_simulated=True,
                )
                db.add(energy_rec)

        # Seed Sample Alerts
        print("Seeding baseline alerts...")
        sample_alerts = [
            (
                maitri.id,
                "ENVIRONMENT",
                "WARNING",
                "Moderate Katabatic Wind Burst",
                "Wind velocity reached 68.4 km/h with blowing drift snow in Schirmacher Oasis.",
                now - timedelta(hours=14),
                True,
            ),
            (
                bharati.id,
                "EQUIPMENT",
                "INFO",
                "Scheduled Generator Maintenance Completed",
                "Routine 250-hour oil filter replacement and injector check completed on Generator 2.",
                now - timedelta(days=2),
                True,
            ),
            (
                maitri.id,
                "SYSTEM",
                "INFO",
                "Microgrid Autonomous Mode Engaged",
                "Digital Twin microgrid controller running in automated economic dispatch mode.",
                now - timedelta(hours=3),
                False,
            ),
        ]

        for st_id, a_type, sev, title, msg, created, ack in sample_alerts:
            alert = Alert(
                station_id=st_id,
                alert_type=a_type,
                severity=sev,
                title=title,
                message=msg,
                source="SystemInit",
                acknowledged=ack,
                created_at=created,
                resolved_at=created + timedelta(hours=1) if ack else None,
            )
            db.add(alert)

        # Seed Load Groups
        print("Seeding electrical load groups for each station...")
        from app.models.audit import LoadGroup
        from app.models.maintenance import MaintenanceTask, ResupplyRequest

        load_configs = [
            ("Life Support & Air Handling", "CRITICAL", 35.0, 1, True, False),
            ("Primary HVAC Thermal Loop", "CRITICAL", 30.0, 1, True, False),
            ("Desalination & Water Distribution", "CRITICAL", 12.0, 2, True, False),
            ("Satellite Comms & Telemetry", "CRITICAL", 6.0, 1, True, False),
            ("Deep Ice Core Lab & Freezers", "HIGH_PRIORITY", 16.0, 3, True, True),
            ("Atmospheric LIDAR & Radar", "HIGH_PRIORITY", 14.0, 3, True, True),
            ("Living Quarters & Galley Lighting", "NON_CRITICAL", 9.0, 4, True, True),
            ("Recreation & Sauna Module", "NON_CRITICAL", 12.0, 5, True, True),
            ("Auxiliary Workshop Tools", "NON_CRITICAL", 8.0, 5, True, True),
        ]

        for st in stations:
            for name, cat, power, prio, enabled, shedable in load_configs:
                lg = LoadGroup(
                    station_id=st.id,
                    name=name,
                    category=cat,
                    current_power_kw=power,
                    priority=prio,
                    enabled=enabled,
                    shedable=shedable,
                )
                db.add(lg)

        # Seed Sample Maintenance Tasks
        print("Seeding sample maintenance tasks...")
        maint1 = MaintenanceTask(
            station_id=maitri.id,
            equipment_id=1,
            title="Generator 1 250-Hour Scheduled Servicing",
            description="Routine oil filter replacement, injector nozzle inspection, and valve clearance calibration.",
            priority="MEDIUM",
            status="SCHEDULED",
            recommended_by="RoutineMaintenanceSchedule",
            assigned_to="Maitri Lead Mechanical Engineer",
            created_at=now - timedelta(days=3),
            scheduled_for=now + timedelta(days=5),
        )
        maint2 = MaintenanceTask(
            station_id=bharati.id,
            equipment_id=None,
            title="Roof Snow Clearing & Solar Panel Inspection",
            description="Clear windblown snow pack from secondary solar mounting brackets on Module B.",
            priority="LOW",
            status="OPEN",
            recommended_by="WeatherWatch",
            assigned_to="Bharati Expedition Crew",
            created_at=now - timedelta(hours=8),
        )
        db.add_all([maint1, maint2])

        # Seed Sample Resupply Request
        resupply1 = ResupplyRequest(
            station_id=maitri.id,
            item="FUEL",
            quantity=15000.0,
            unit="liters",
            priority="HIGH",
            reason="Projected mid-winter fuel reserve augmentation via coastal ice shelf convoy.",
            status="REQUESTED",
            requested_by="Maitri Station Commander",
            requested_at=now - timedelta(days=1),
        )
        db.add(resupply1)

        db.commit()
        print("\n Seeding completed successfully!")
        print("Stations seeded: Maitri (MAITRI), Bharati (BHARATI)")
        print(f"Total Equipment seeded: {db.query(Equipment).count()}")
        print(f"Total Logistics Items seeded: {db.query(LogisticsItem).count()}")
        print(f"Total Electrical Load Groups seeded: {db.query(LoadGroup).count()}")
        print(f"Total Maintenance Tasks seeded: {db.query(MaintenanceTask).count()}")
        print(f"Total Resupply Requests seeded: {db.query(ResupplyRequest).count()}")
        print(f"Total Historical Sensor records: {db.query(SensorTelemetry).count()}")
        print(f"Total Historical Energy records: {db.query(EnergyTelemetry).count()}")
        print(f"Total Alerts seeded: {db.query(Alert).count()}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
