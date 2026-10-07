"""VinculaTec API — backend único para la web y la app móvil.

Ejecutar:  uvicorn app.main:app --reload
Docs:      http://localhost:8000/docs  (Swagger)  ·  /redoc
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

import app.models  # noqa: F401  (registra los modelos en Base.metadata)
from app.core.config import settings
from app.core.database import Base, add_missing_columns, engine
from app.routers import admin, auth, challenges, insights, organizations, teams, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    # En producción conviene usar Alembic; create_all basta para desarrollo y demo
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "API REST para vincular universidades, empresas, estudiantes, académicos y gobierno "
        "en la solución colaborativa de problemáticas tecnológicas. Consumible por clientes web "
        "(React/Vue/Angular) y móviles (Flutter/React Native/Kotlin/Swift) mediante JSON + JWT."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # respuestas ligeras para datos móviles


# Nombres de campos tal como se ven en la app
_CAMPOS = {
    "title": "Título", "summary": "Resumen público", "description": "Descripción detallada", "category": "Categoría",
    "tags": "Etiquetas", "required_disciplines": "Carreras requeridas", "min_disciplines": "Mínimo de carreras",
    "modalities": "Válido como", "budget_mxn": "Presupuesto", "duration_weeks": "Duración (semanas)",
    "deadline": "Fecha límite", "confidentiality": "Confidencialidad", "ip_model": "Propiedad intelectual",
    "email": "Correo", "password": "Contraseña", "full_name": "Nombre completo", "role": "Rol", "career": "Carrera",
    "semester": "Semestre", "skills": "Habilidades", "bio": "Sobre mí", "portfolio_url": "Portafolio",
    "name": "Nombre", "size": "Tamaño", "sector": "Giro o sector", "city": "Municipio o ciudad", "state": "Estado",
    "approach": "Enfoque", "work_plan": "Plan de trabajo", "estimated_weeks": "Semanas estimadas", "team_id": "Equipo",
    "score": "Calificación", "comment": "Comentario", "text": "Mensaje", "feedback": "Comentario",
    "deliverable_url": "Enlace de la entrega", "due_date": "Fecha de entrega", "status": "Estado",
}


def _mensaje(e: dict) -> str:
    ctx, tipo = e.get("ctx") or {}, e.get("type", "")
    campo = next((_CAMPOS.get(str(p), str(p)) for p in reversed(e.get("loc", ())) if isinstance(p, str) and p != "body"), "")
    texto = {
        "missing": "es obligatorio",
        "string_too_short": f"debe tener al menos {ctx.get('min_length')} caracteres",
        "string_too_long": f"no puede tener más de {ctx.get('max_length')} caracteres",
        "greater_than_equal": f"debe ser {ctx.get('ge')} o más",
        "less_than_equal": f"debe ser {ctx.get('le')} o menos",
        "greater_than": f"debe ser mayor que {ctx.get('gt')}",
        "int_parsing": "debe ser un número entero", "int_from_float": "debe ser un número entero",
        "float_parsing": "debe ser un número",
        "date_parsing": "no es una fecha válida", "date_from_datetime_parsing": "no es una fecha válida",
        "enum": "no es una opción válida", "literal_error": "no es una opción válida",
        "url_parsing": "no es un enlace válido",
    }.get(tipo)
    if texto is None:
        texto = "no es un correo válido" if campo == "Correo" else str(e.get("msg", "")).removeprefix("Value error, ")
    return f"{campo}: {texto}" if campo else texto


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    """Errores de validación en español y con el nombre del campo que ve la persona."""
    return JSONResponse(status_code=422, content={"detail": "\n".join(dict.fromkeys(_mensaje(e) for e in exc.errors()))})


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "Conflicto de datos: registro duplicado o relación inválida"})


for r in (auth.router, users.router, organizations.router, challenges.router, teams.router, insights.router,
          admin.router):
    app.include_router(r, prefix=settings.API_PREFIX)


@app.get("/", tags=["Salud"])
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}


@app.get("/health", tags=["Salud"])
def health():
    return {"status": "ok"}
