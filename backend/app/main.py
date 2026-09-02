import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Set
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import APIError, create_error_response
from app.services.simulation_service import simulation_service
from app.services.command_service import command_service
from app.api.stations import router as stations_router
from app.api.environment import router as environment_router
from app.api.energy import router as energy_router
from app.api.equipment import router as equipment_router
from app.api.logistics import router as logistics_router
from app.api.alerts import router as alerts_router
from app.api.predictions import router as predictions_router
from app.api.simulation import router as simulation_router
from app.api.dashboard import router as dashboard_router
from app.api.commands import router as commands_router
from app.api.maintenance import router as maintenance_router
from app.api.operations import router as operations_router
from app.api.copilot import router as copilot_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("app.main")


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        # station_code (lowercase) -> Set of active WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, station_code: str, websocket: WebSocket):
        await websocket.accept()
        code = station_code.lower()
        if code not in self.active_connections:
            self.active_connections[code] = set()
        self.active_connections[code].add(websocket)
        logger.info(f"WebSocket client connected to stream for station '{code}'. Total clients: {len(self.active_connections[code])}")

    def disconnect(self, station_code: str, websocket: WebSocket):
        code = station_code.lower()
        if code in self.active_connections:
            self.active_connections[code].discard(websocket)
            if not self.active_connections[code]:
                del self.active_connections[code]
        logger.info(f"WebSocket client disconnected from station '{code}'.")

    async def broadcast_station_update(self, station_code: str, message: dict):
        code = station_code.lower()
        sockets = list(self.active_connections.get(code, set()))
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.debug(f"Failed to send update to client on {code}: {e}")
                self.disconnect(code, ws)


ws_manager = ConnectionManager()


# Background Simulation Worker Loop
async def simulation_background_worker():
    logger.info(f"Background simulation loop active. Interval: {settings.SIMULATION_INTERVAL_SECONDS}s")
    while True:
        try:
            if simulation_service.is_running:
                db = SessionLocal()
                try:
                    await simulation_service.tick(db)
                except Exception as e:
                    logger.error(f"Error during simulation cycle tick: {e}", exc_info=True)
                finally:
                    db.close()
        except asyncio.CancelledError:
            logger.info("Simulation background worker received shutdown cancellation.")
            break
        except Exception as err:
            logger.error(f"Unexpected worker exception: {err}", exc_info=True)

        await asyncio.sleep(settings.SIMULATION_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Polar Twin Antarctic Backend...")
    init_db()

    # Auto-seed database if fresh deployment
    try:
        from app.models.station import Station
        db = SessionLocal()
        try:
            if db.query(Station).count() == 0:
                logger.info("Fresh database detected. Auto-seeding initial station and telemetry data...")
                from seed import seed_database
                seed_database()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Auto-seed check notice: {e}")

    simulation_service.set_broadcast_callback(ws_manager.broadcast_station_update)
    command_service.set_broadcast_callback(ws_manager.broadcast_station_update)
    sim_task = asyncio.create_task(simulation_background_worker())
    logger.info("Polar Twin Backend initialized and ready for requests.")
    yield
    # Shutdown
    logger.info("Shutting down background workers...")
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Digital Twin framework for Maitri and Bharati Indian Antarctic research stations integrating infrastructure, microgrid energy, logistics, and environmental telemetry.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
configured_origins = (
    settings.CORS_ORIGINS
    if isinstance(settings.CORS_ORIGINS, list)
    else [settings.CORS_ORIGINS]
)

if "*" in configured_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=configured_origins,
        allow_origin_regex=r"^https://.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Exception Handlers
@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return create_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return create_error_response(
        code="HTTP_ERROR",
        message=str(exc.detail),
        status_code=exc.status_code,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return create_error_response(
        code="VALIDATION_ERROR",
        message="Invalid request payload or query parameters.",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        details=exc.errors(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.url.path}: {exc}", exc_info=True)
    return create_error_response(
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected internal error occurred. Please check server logs.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


# Register API Routers
app.include_router(stations_router, prefix=settings.API_V1_STR)
app.include_router(environment_router, prefix=settings.API_V1_STR)
app.include_router(energy_router, prefix=settings.API_V1_STR)
app.include_router(equipment_router, prefix=settings.API_V1_STR)
app.include_router(logistics_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(predictions_router, prefix=settings.API_V1_STR)
app.include_router(simulation_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(commands_router, prefix=settings.API_V1_STR)
app.include_router(maintenance_router, prefix=settings.API_V1_STR)
app.include_router(operations_router, prefix=settings.API_V1_STR)
app.include_router(copilot_router, prefix=settings.API_V1_STR)


# Root and Health Endpoints
@app.get("/", tags=["System"])
def root():
    return {
        "system": "POLAR-TWIN — Antarctic Digital Twin Platform",
        "stations": ["Maitri (MAITRI)", "Bharati (BHARATI)"],
        "status": "OPERATIONAL",
        "documentation": "/docs",
        "data_provenance_notice": "Clear separation maintained between public geographic coordinates, external weather telemetry, simulated sensor streams, and ML predictions.",
    }


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
@app.head("/health", tags=["System"])
@app.head("/api/health", tags=["System"])
def health_check():
    db = SessionLocal()
    db_ok = True
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_ok = False
    finally:
        db.close()

    sim_status = simulation_service.get_status()

    return {
        "status": "healthy" if db_ok else "degraded",
        "database_connected": db_ok,
        "simulation_running": sim_status.is_running,
        "simulation_interval_seconds": sim_status.interval_seconds,
        "active_scenarios": sim_status.active_scenarios,
        "version": settings.VERSION,
    }


@app.get("/ping", tags=["System"])
@app.get("/api/ping", tags=["System"])
@app.head("/ping", tags=["System"])
@app.head("/api/ping", tags=["System"])
def ping():
    """Ultra-lightweight keep-alive ping endpoint for uptime monitors (UptimeRobot, BetterStack, Cron-job.org)."""
    return {"pong": True, "status": "ok"}


# WebSocket Endpoint for Live Telemetry Streaming
@app.websocket("/ws/stations/{station_id}")
async def websocket_station_stream(websocket: WebSocket, station_id: str):
    """
    WebSocket streaming endpoint for real-time station telemetry updates.
    Broadcasts live updates whenever simulation cycles occur or conditions change.
    """
    station_code = station_id.lower()
    await ws_manager.connect(station_code, websocket)
    try:
        while True:
            # Keep socket alive and accept client pings/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(station_code, websocket)
    except Exception as e:
        logger.debug(f"WebSocket connection closed on {station_code}: {e}")
        ws_manager.disconnect(station_code, websocket)
