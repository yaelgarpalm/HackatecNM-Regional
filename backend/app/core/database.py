"""Motor y sesión de SQLAlchemy. Funciona con SQLite y PostgreSQL."""
import json
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    connect_args: dict = {"check_same_thread": False}
    pool_args: dict = {}
else:
    # Azure Database for PostgreSQL exige conexiones cifradas (SSL)
    connect_args = {} if "sslmode=" in settings.DATABASE_URL else {"sslmode": "require"}
    # El plan básico de Azure admite ~35 conexiones para todos (backend de cada integrante, --reload,
    # scripts). Pocas por proceso, y se renuevan antes de que la base cierre las inactivas
    # (idle_session_timeout = 5 min en la base vinculatec).
    pool_args = {"pool_size": 3, "max_overflow": 2, "pool_recycle": 240, "pool_timeout": 15}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    **pool_args,
    # Guarda acentos y ñ tal cual en columnas JSON (permite buscar "diseño")
    json_serializer=lambda obj: json.dumps(obj, ensure_ascii=False),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
