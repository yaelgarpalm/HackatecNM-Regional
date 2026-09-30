"""Carga datos de demostración para presentar la plataforma.

Uso:  python seed.py        (contraseña de todas las cuentas: Demo12345)

BORRA todas las tablas de la base de Azure antes de cargar; exige confirmar con:
    python seed.py --borrar-todo
"""
import sys
from datetime import date, timedelta

import app.models  # noqa: F401
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import Capability, Challenge, Organization, User
from app.models.enums import (
    CapabilityType, ChallengeStatus, Confidentiality, IPModel, OrgSize, OrgType, Role,
)

PWD = hash_password("Demo12345")


def run() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    tessfp = Organization(name="TES San Felipe del Progreso", type=OrgType.UNIVERSIDAD, verified=True,
                          city="San Felipe del Progreso", state="Estado de México",
                          description="Tecnológico de Estudios Superiores", latitude=19.7128, longitude=-99.9531)
    uaem = Organization(name="Universidad Autónoma del Estado de México", type=OrgType.UNIVERSIDAD,
                        verified=True, city="Toluca", state="Estado de México", latitude=19.2826, longitude=-99.6557)
    panaderia = Organization(name="Panadería La Espiga", type=OrgType.EMPRESA, size=OrgSize.MICRO,
                             sector="Alimentos", city="Atlacomulco", state="Estado de México", verified=True,
                             latitude=19.7976, longitude=-99.8765)
    coop = Organization(name="Cooperativa Textil Mazahua", type=OrgType.EMPRESA, size=OrgSize.COOPERATIVA,
                        sector="Textil artesanal", city="San Felipe del Progreso", state="Estado de México",
                        latitude=19.7150, longitude=-99.9480)
    municipio = Organization(name="H. Ayuntamiento de San Felipe del Progreso", type=OrgType.GOBIERNO,
                             city="San Felipe del Progreso", state="Estado de México", verified=True,
                             latitude=19.7127, longitude=-99.9525)
    db.add_all([tessfp, uaem, panaderia, coop, municipio])
    db.flush()

    def user(email, name, role, org, **kw):
        u = User(email=email, full_name=name, role=role, organization_id=org.id if org else None,
                 hashed_password=PWD, **kw)
        db.add(u)
        return u

    user("admin@vinculatec.mx", "Administrador", Role.ADMIN, None)
    user("vinculacion@tessfp.edu.mx", "Oficina de Vinculación TESSFP", Role.UNIVERSIDAD, tessfp)
    laura = user("laura@laespiga.mx", "Laura Pérez", Role.EMPRESA, panaderia)
    rosa = user("rosa@textilmazahua.mx", "Rosa Martínez", Role.EMPRESA, coop)
    muni = user("innovacion@sanfelipe.gob.mx", "Dirección de Innovación", Role.GOBIERNO, municipio)
    user("dra.martinez@tessfp.edu.mx", "Dra. Elena Martínez", Role.ACADEMICO, tessfp,
         career="Ingeniería en Sistemas Computacionales", skills=["IoT", "Python", "Machine Learning"])
    user("ana@tessfp.edu.mx", "Ana López", Role.ESTUDIANTE, tessfp, semester=6,
         career="Ingeniería en Sistemas Computacionales", skills=["Python", "FastAPI", "IoT", "SQL"])
    user("beto@tessfp.edu.mx", "Alberto Ruiz", Role.ESTUDIANTE, tessfp, semester=7,
         career="Ingeniería Industrial", skills=["Procesos", "Inventarios", "Lean"])
    user("carla@uaem.mx", "Carla Gómez", Role.ESTUDIANTE, uaem, semester=8,
         career="Licenciatura en Diseño Gráfico", skills=["Diseño", "Marketing digital", "UX"])
    user("diego@tessfp.edu.mx", "Diego Hernández", Role.ESTUDIANTE, tessfp, semester=5,
         career="Ingeniería en Gestión Empresarial", skills=["Finanzas", "Comercio electrónico", "Costos"])

    db.flush()

    db.add_all([
        Capability(organization_id=tessfp.id, type=CapabilityType.LABORATORIO, name="Laboratorio de IoT",
                   description="ESP32, Raspberry Pi, sensores de temperatura, humedad y gas",
                   tags=["IoT", "sensores", "automatización", "temperatura"]),
        Capability(organization_id=tessfp.id, type=CapabilityType.SERVICIO, name="Desarrollo de software a la medida",
                   description="Aplicaciones web y móviles, bases de datos",
                   tags=["software", "web", "móvil", "bases de datos", "comercio electrónico"]),
        Capability(organization_id=uaem.id, type=CapabilityType.EXPERTO, name="Consultoría en diseño de marca",
                   description="Identidad visual y estrategia digital para MiPyMEs",
                   tags=["diseño", "marketing digital", "marca"]),
    ])

    db.add_all([
        Challenge(organization_id=panaderia.id, created_by_id=laura.id, status=ChallengeStatus.ABIERTO,
                  title="Monitoreo de temperatura en hornos",
                  summary="Perdemos producto porque la temperatura de los hornos varía sin control.",
                  description="Tenemos 3 hornos de gas; hoy registramos la temperatura a mano cada hora.",
                  category="IoT", tags=["IoT", "sensores", "temperatura", "inventarios"],
                  required_disciplines=["Ingeniería en Sistemas Computacionales", "Ingeniería Industrial"], min_disciplines=2,
                  modalities=["residencia", "proyecto_clase"], offers_stipend=True, budget_mxn=15000,
                  duration_weeks=12, deadline=date.today() + timedelta(days=30),
                  confidentiality=Confidentiality.CONFIDENCIAL, ip_model=IPModel.COMPARTIDA),
        Challenge(organization_id=coop.id, created_by_id=rosa.id, status=ChallengeStatus.ABIERTO,
                  title="Tienda en línea para textiles mazahuas",
                  summary="Queremos vender nuestros textiles fuera de la región con pago en línea.",
                  description="Somos 25 artesanas; necesitamos catálogo, pagos y envíos sencillos de administrar.",
                  category="Comercio electrónico", tags=["comercio electrónico", "web", "diseño", "marketing digital"],
                  required_disciplines=["Ingeniería en Sistemas Computacionales", "Licenciatura en Diseño Gráfico",
                                        "Ingeniería en Gestión Empresarial"],
                  min_disciplines=2, modalities=["servicio_social", "residencia"], duration_weeks=16,
                  ip_model=IPModel.EMPRESA),
        Challenge(organization_id=municipio.id, created_by_id=muni.id, status=ChallengeStatus.ABIERTO,
                  title="Reporte ciudadano de fugas de agua",
                  summary="App para que la ciudadanía reporte fugas con foto y ubicación.",
                  description="Hoy los reportes llegan por teléfono y se pierden; queremos un mapa de atención.",
                  category="Gobierno digital", tags=["móvil", "web", "mapas", "bases de datos"],
                  required_disciplines=["Ingeniería en Sistemas Computacionales", "Ingeniería Civil"], min_disciplines=1,
                  modalities=["servicio_social", "tesis"], ip_model=IPModel.ABIERTA),
    ])
    db.commit()
    db.close()
    print("Datos de demo cargados. Contraseña para todas las cuentas: Demo12345")


if __name__ == "__main__":
    if "--borrar-todo" not in sys.argv:
        sys.exit(f"La base configurada es {engine.url.render_as_string(hide_password=True)}\n"
                 "seed.py BORRA todos los datos. Si de verdad quieres reiniciarla, ejecuta:\n"
                 "  python seed.py --borrar-todo")
    run()
