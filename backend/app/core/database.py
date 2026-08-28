import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool
from app.core.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL
connect_args = {}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # Use NullPool so each session gets a fresh connection. This prevents
    # stale-transaction issues where the background simulation worker and
    # API request handlers share the same SQLite connection (SingletonThreadPool)
    # and one sees outdated data from the other's transaction.
    engine = create_engine(db_url, connect_args=connect_args, echo=False, poolclass=NullPool)
else:
    # PostgreSQL / Other engines
    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            echo=False,
        )
    except Exception as e:
        logger.warning(
            f"Could not connect to PostgreSQL ({db_url}): {e}. Falling back to local SQLite database."
        )
        sqlite_fallback = "sqlite:///./polar_twin.db"
        engine = create_engine(sqlite_fallback, connect_args={"check_same_thread": False}, echo=False, poolclass=NullPool)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initializes all database tables registered on Base."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
