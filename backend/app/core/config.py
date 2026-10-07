"""Configuración central leída desde variables de entorno / archivo .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "VinculaTec API"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # Azure Database for PostgreSQL (obligatoria, en backend/.env), p. ej.:
    # DATABASE_URL=postgresql+psycopg://usuario:clave@mi-servidor.postgres.database.azure.com:5432/vinculatec?sslmode=require
    # Sin valor por defecto: la única base de la plataforma es la de Azure.
    DATABASE_URL: str = ""

    # Ubicar organizaciones con OpenStreetMap (Nominatim). Los tests lo apagan.
    GEOCODING_ENABLED: bool = True

    # JWT
    SECRET_KEY: str = "cambia-esta-clave-en-produccion-por-una-larga-y-aleatoria"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Orígenes permitidos (web). Las apps móviles nativas no usan CORS.
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",
    ]
    # En desarrollo acepta cualquier puerto de localhost y de la red local (Expo web, pruebas desde el celular),
    # y la web publicada en cirus.online (deploy/windows) cuando llama a este backend en Azure
    CORS_ORIGIN_REGEX: str | None = (
        r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|(www\.)?cirus\.online)(:\d+)?"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
