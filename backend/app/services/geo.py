"""Ubicación de organizaciones: geocodificación con OpenStreetMap (Nominatim) y distancias.

Nominatim es gratuito pero pide identificarse con un User-Agent, máximo ~1 consulta por segundo
y mostrar la atribución de OpenStreetMap en los mapas.
"""
import json
import math
import urllib.parse
import urllib.request

from app.core.config import settings

NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "VinculaTec/1.0 (plataforma de vinculacion universidad-empresa)"


def geocode(city: str | None, state: str | None, name: str | None = None) -> tuple[float, float] | None:
    """Coordenadas (lat, lng) de la ciudad/estado en México, o None si no se encuentra o no hay red.

    Primero intenta con el nombre de la organización (p. ej. una universidad conocida) y si no, la ciudad.
    """
    if not settings.GEOCODING_ENABLED or not (city or state):
        return None
    lugar = ", ".join(p for p in (city, state) if p)
    for q in ([f"{name}, {lugar}"] if name else []) + [lugar]:
        params = urllib.parse.urlencode({"q": f"{q}, México", "format": "json", "limit": 1, "countrycodes": "mx"})
        req = urllib.request.Request(f"{NOMINATIM}?{params}", headers={"User-Agent": USER_AGENT, "Accept-Language": "es"})
        try:
            with urllib.request.urlopen(req, timeout=6) as r:
                data = json.load(r)
        except Exception:
            return None  # sin red o servicio caído: la ubicación se puede poner a mano en el mapa
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    return None


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en línea recta (fórmula de haversine)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
