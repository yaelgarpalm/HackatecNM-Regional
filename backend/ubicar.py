"""Ubica en el mapa las organizaciones que aún no tienen coordenadas (usa su ciudad y estado).

Uso:  python ubicar.py
Consulta OpenStreetMap (Nominatim) respetando su límite de 1 consulta por segundo.
"""
import time

import app.models  # noqa: F401
from app.core.database import SessionLocal, add_missing_columns
from app.models import Organization
from app.services.geo import geocode


def run() -> None:
    add_missing_columns()
    db = SessionLocal()
    pendientes = db.query(Organization).filter(Organization.latitude.is_(None)).all()
    print(f"{len(pendientes)} organizaciones sin ubicación")
    for o in pendientes:
        coords = geocode(o.city, o.state, o.name)
        if coords:
            o.latitude, o.longitude = coords
            db.commit()
            print(f"  ✓ {o.name}: {coords[0]:.4f}, {coords[1]:.4f}")
        else:
            print(f"  ✗ {o.name}: sin ciudad/estado o no encontrada (ubícala tocando el mapa en 'Mi organización')")
        time.sleep(1.1)
    db.close()


if __name__ == "__main__":
    run()
