"""VinculaTec API — backend único para la web y la app móvil.

Ejecutar:  uvicorn app.main:app --reload
Docs:      http://localhost:8000/docs  (Swagger)  ·  /redoc
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

import app.models  # noqa: F401  (registra los modelos en Base.metadata)
from app.core.config import settings
from app.core.database import Base, engine
from app.routers import auth, challenges, insights, organizations, teams, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    # En producción conviene usar Alembic; create_all basta para desarrollo y demo
    Base.metadata.create_all(bind=engine)
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


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "Conflicto de datos: registro duplicado o relación inválida"})


for r in (auth.router, users.router, organizations.router, challenges.router, teams.router, insights.router):
    app.include_router(r, prefix=settings.API_PREFIX)


@app.get("/", tags=["Salud"])
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}


@app.get("/health", tags=["Salud"])
def health():
    return {"status": "ok"}
