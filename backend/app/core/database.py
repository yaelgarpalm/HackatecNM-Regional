"""Motor y sesión de SQLAlchemy para Supabase PostgreSQL."""
import json
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

if not settings.DATABASE_URL.startswith("postgresql"):
    raise RuntimeError(
        "Falta DATABASE_URL. Copia backend/.env.example como backend/.env y pon la conexión a Supabase PostgreSQL "
        "(en Azure App Service, guárdala en Application settings; no la subas a GitHub)."
    )

# Exige conexiones cifradas (SSL) para conexiones PostgreSQL remotas.
connect_args = {} if "sslmode=" in settings.DATABASE_URL else {"sslmode": "require"}
# Mantén pocas conexiones por proceso para evitar agotar el límite del pool de la base.
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


def add_missing_columns() -> None:
    """Agrega columnas nuevas a tablas que ya existen (create_all solo crea tablas nuevas).

    Mientras el proyecto no use Alembic, basta con listar aquí las columnas añadidas después.
    """
    from sqlalchemy import inspect, text

    nuevas = {"organizations": {"latitude": "FLOAT", "longitude": "FLOAT"}}
    insp = inspect(engine)
    with engine.begin() as conn:
        for tabla, cols in nuevas.items():
            if not insp.has_table(tabla):
                continue
            existentes = {c["name"] for c in insp.get_columns(tabla)}
            for col, tipo in cols.items():
                if col not in existentes:
                    conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {col} {tipo}"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
