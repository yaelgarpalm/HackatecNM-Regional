"""Prueba de extremo a extremo del flujo principal de la plataforma."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_vinculatec.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

API = "/api/v1"


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_vinculatec.db"):
        os.remove("test_vinculatec.db")


def register(c, **kw):
    kw.setdefault("password", "Secreta123")
    r = c.post(f"{API}/auth/register", json=kw)
    assert r.status_code == 201, r.text
    return r.json()


def login(c, email):
    r = c.post(f"{API}/auth/login", json={"email": email, "password": "Secreta123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_flujo_completo(client):
    c = client
    # --- Registro de actores
    emp = register(c, email="dueno@panaderia.mx", full_name="Laura Pérez", role="empresa",
                   organization={"name": "Panadería La Espiga", "type": "empresa", "size": "micro",
                                 "sector": "Alimentos", "state": "Estado de México"})
    uni = register(c, email="vinculacion@tessfp.edu.mx", full_name="Oficina de Vinculación", role="universidad",
                   organization={"name": "TESSFP", "type": "universidad", "state": "Estado de México"})
    uni_id = uni["organization_id"]
    register(c, email="ana@tessfp.edu.mx", full_name="Ana López", role="estudiante", organization_id=uni_id,
             career="Ingeniería en Sistemas Computacionales", semester=6, skills=["Python", "IoT", "Bases de datos"])
    beto = register(c, email="beto@tessfp.edu.mx", full_name="Beto Ruiz", role="estudiante",
                    organization_id=uni_id, career="Ingeniería Industrial", skills=["Procesos", "Inventarios"])
    prof = register(c, email="prof@tessfp.edu.mx", full_name="Dra. Martínez", role="academico",
                    organization_id=uni_id, career="Ingeniería en Sistemas Computacionales", skills=["IoT"])

    h_emp, h_uni = login(c, "dueno@panaderia.mx"), login(c, "vinculacion@tessfp.edu.mx")
    h_ana, h_beto, h_prof = login(c, "ana@tessfp.edu.mx"), login(c, "beto@tessfp.edu.mx"), login(c, "prof@tessfp.edu.mx")

    # No se puede registrar admin ni duplicar correo
    assert c.post(f"{API}/auth/register", json={"email": "x@x.mx", "password": "Secreta123",
                                                "full_name": "X", "role": "admin"}).status_code == 422
    assert c.post(f"{API}/auth/register", json={"email": "ana@tessfp.edu.mx", "password": "Secreta123",
                                                "full_name": "Ana", "role": "estudiante"}).status_code == 409

    # --- La universidad publica capacidades
    r = c.post(f"{API}/organizations/{uni_id}/capabilities", headers=h_uni, json={
        "type": "laboratorio", "name": "Laboratorio de IoT y Sensores",
        "description": "Sensores de temperatura, humedad y microcontroladores ESP32", "tags": ["IoT", "sensores", "temperatura"]})
    assert r.status_code == 201, r.text
    # Una empresa no puede registrar capacidades
    assert c.post(f"{API}/organizations/{uni_id}/capabilities", headers=h_emp,
                  json={"type": "equipo", "name": "Horno"}).status_code == 403

    # --- La empresa publica un reto confidencial
    r = c.post(f"{API}/challenges", headers=h_emp, json={
        "title": "Monitoreo de temperatura de hornos",
        "summary": "Perdemos producto porque la temperatura del horno varía sin control.",
        "description": "Detalle confidencial: tenemos 3 hornos de gas y registramos a mano la temperatura cada hora.",
        "category": "IoT", "tags": ["IoT", "sensores", "temperatura", "inventarios"],
        "required_disciplines": ["Sistemas Computacionales", "Industrial"], "min_disciplines": 2,
        "modalities": ["residencia", "proyecto_clase"], "offers_stipend": True, "budget_mxn": 15000,
        "confidentiality": "confidencial", "ip_model": "compartida", "publish": True})
    assert r.status_code == 201, r.text
    ch = r.json()
    assert ch["status"] == "abierto" and ch["nda_required"] is False  # el dueño siempre ve el detalle

    # Un estudiante ve el reto pero no la descripción hasta aceptar NDA
    r = c.get(f"{API}/challenges/{ch['id']}", headers=h_ana).json()
    assert r["description"] is None and r["nda_required"] is True
    anon = c.get(f"{API}/challenges").json()
    assert anon["total"] == 1 and anon["items"][0]["description"] is None

    # Recomendaciones para Ana
    recs = c.get(f"{API}/recommendations/challenges", headers=h_ana).json()
    assert recs and recs[0]["challenge"]["id"] == ch["id"] and recs[0]["score"] > 0.5

    # La empresa ve capacidades y talento afines
    caps = c.get(f"{API}/challenges/{ch['id']}/matches/capabilities", headers=h_emp).json()
    assert caps and caps[0]["organization_name"] == "TESSFP"
    talent = c.get(f"{API}/challenges/{ch['id']}/matches/talent", headers=h_emp).json()
    assert talent[0]["user"]["full_name"] == "Ana López"

    # --- Equipo: Ana líder; solo una carrera -> no puede postularse
    team = c.post(f"{API}/teams", headers=h_ana, json={"name": "Los Horneros"}).json()
    c.post(f"{API}/challenges/{ch['id']}/nda", headers=h_ana)
    r = c.post(f"{API}/challenges/{ch['id']}/proposals", headers=h_ana,
               json={"team_id": team["id"], "approach": "Red de sensores ESP32 con alertas por WhatsApp."})
    assert r.status_code == 422  # regla multidisciplinaria

    # Agrega a Beto (Industrial) y a la profesora como asesora
    c.post(f"{API}/teams/{team['id']}/members", headers=h_ana, json={"user_id": beto["id"]})
    r = c.post(f"{API}/teams/{team['id']}/members", headers=h_ana, json={"user_id": prof["id"], "role": "asesor"})
    assert set(r.json()["disciplines"]) == {"Ingeniería en Sistemas Computacionales", "Ingeniería Industrial"}
    # Beto (integrante) no puede agregar gente
    assert c.post(f"{API}/teams/{team['id']}/members", headers=h_beto,
                  json={"user_id": emp["id"]}).status_code == 403

    r = c.post(f"{API}/challenges/{ch['id']}/proposals", headers=h_ana,
               json={"team_id": team["id"], "approach": "Red de sensores ESP32 con alertas por WhatsApp.",
                     "estimated_weeks": 8})
    assert r.status_code == 201, r.text
    prop = r.json()
    assert prop["discipline_coverage"] == 1.0

    # Beto quedó cubierto por el NDA al postular el equipo
    assert c.get(f"{API}/challenges/{ch['id']}", headers=h_beto).json()["description"] is not None

    # La empresa recibió notificación y acepta
    notifs = c.get(f"{API}/users/me/notifications", headers=h_emp).json()
    assert notifs["total"] == 1
    # La empresa ve las postulaciones recibidas desde su perfil; un estudiante no puede
    received = c.get(f"{API}/proposals/received", headers=h_emp).json()
    assert [p["id"] for p in received] == [prop["id"]] and received[0]["challenge_title"] == ch["title"]
    assert c.get(f"{API}/proposals/received", headers=h_ana).status_code == 403
    r = c.patch(f"{API}/proposals/{prop['id']}", headers=h_emp,
                json={"status": "aceptada", "feedback": "¡Excelente propuesta!"})
    assert r.status_code == 200 and r.json()["status"] == "aceptada"
    assert c.get(f"{API}/challenges/{ch['id']}", headers=h_emp).json()["status"] == "en_progreso"

    # --- Seguimiento: hito, entrega y revisión
    m = c.post(f"{API}/challenges/{ch['id']}/milestones", headers=h_emp,
               json={"title": "Prototipo con 1 sensor", "due_date": "2026-11-15"}).json()
    assert c.post(f"{API}/milestones/{m['id']}/deliver", headers=h_emp,
                  json={"deliverable_url": "x"}).status_code == 403
    c.post(f"{API}/milestones/{m['id']}/deliver", headers=h_beto,
           json={"deliverable_url": "https://github.com/horneros/prototipo"})
    r = c.post(f"{API}/milestones/{m['id']}/review", headers=h_emp, json={"status": "aprobado"})
    assert r.json()["status"] == "aprobado"

    # --- Participantes y postulaciones propias
    parts = {u["full_name"] for u in c.get(f"{API}/challenges/{ch['id']}/participants", headers=h_beto).json()}
    assert parts == {"Laura Pérez", "Ana López", "Beto Ruiz", "Dra. Martínez"}
    mine = c.get(f"{API}/proposals/mine", headers=h_prof).json()
    assert len(mine) == 1 and mine[0]["status"] == "aceptada"

    # --- Mensajería (y un externo no puede leerla)
    c.post(f"{API}/challenges/{ch['id']}/messages", headers=h_ana, json={"body": "¿Podemos visitar la panadería el lunes?"})
    c.post(f"{API}/challenges/{ch['id']}/messages", headers=h_emp, json={"body": "Claro, a las 9."})
    msgs = c.get(f"{API}/challenges/{ch['id']}/messages", headers=h_prof).json()
    assert [x["body"] for x in msgs][-1] == "Claro, a las 9."
    assert c.get(f"{API}/challenges/{ch['id']}/messages", headers=h_uni).status_code == 403

    # --- Cierre y evaluación mutua
    assert c.post(f"{API}/challenges/{ch['id']}/reviews", headers=h_emp,
                  json={"reviewee_id": beto["id"], "score": 5}).status_code == 409  # aún no finaliza
    c.patch(f"{API}/challenges/{ch['id']}/status", headers=h_emp, json={"status": "finalizado"})
    r = c.post(f"{API}/challenges/{ch['id']}/reviews", headers=h_emp,
               json={"reviewee_id": beto["id"], "score": 5, "comment": "Muy profesional"})
    assert r.status_code == 201
    assert c.get(f"{API}/users/{beto['id']}", headers=h_ana).json()["rating_avg"] == 5.0
    c.post(f"{API}/challenges/{ch['id']}/reviews", headers=h_ana, json={"reviewee_id": emp["id"], "score": 4})

    # Transición inválida
    assert c.patch(f"{API}/challenges/{ch['id']}/status", headers=h_emp,
                   json={"status": "abierto"}).status_code == 409

    # --- Indicadores
    s = c.get(f"{API}/stats").json()
    assert s["retos"]["finalizado"] == 1 and s["hitos_aprobados"] == 1
    u = c.get(f"{API}/stats/university/{uni_id}", headers=h_uni).json()
    assert u["proyectos_vinculados"] == 1 and u["empresas_atendidas"] == 1

    # --- Búsquedas y catálogos
    assert c.get(f"{API}/users?q=inventarios", headers=h_emp).json()["total"] == 1
    capq = c.get(f"{API}/capabilities?q=sensores").json()
    assert capq["total"] == 1
    assert c.get(f"{API}/capabilities/{capq['items'][0]['id']}").status_code == 200
    # CORS para Expo web en cualquier puerto local
    pre = c.options(f"{API}/challenges", headers={"Origin": "http://localhost:8082",
                                                  "Access-Control-Request-Method": "GET"})
    assert pre.headers.get("access-control-allow-origin") == "http://localhost:8082"
    assert "residencia" in c.get(f"{API}/catalogs").json()["modalidades"]


def test_refresh_y_seguridad(client):
    r = client.post(f"{API}/auth/login", json={"email": "ana@tessfp.edu.mx", "password": "Secreta123"}).json()
    new = client.post(f"{API}/auth/refresh", json={"refresh_token": r["refresh_token"]})
    assert new.status_code == 200
    # Un access token no sirve como refresh, ni viceversa
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": r["access_token"]}).status_code == 401
    assert client.get(f"{API}/auth/me",
                      headers={"Authorization": f"Bearer {r['refresh_token']}"}).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": "ana@tessfp.edu.mx",
                                                  "password": "mala"}).status_code == 401


def test_problematica_solo_visible_para_carreras_requeridas(client):
    c = client
    register(c, email="rh@agroempresa.mx", full_name="Recursos Humanos", role="empresa",
             organization={"name": "AgroEmpresa", "type": "empresa", "state": "Estado de México"})
    uni_id = register(c, email="vinc@tecnm.mx", full_name="Vinculación", role="universidad",
                      organization={"name": "TecNM Campus", "type": "universidad"})["organization_id"]
    alumnos = {
        "info@tecnm.mx": "Ingeniería Informática",
        "agro@tecnm.mx": "Ing. en Agronomía",
        "conta@tecnm.mx": "Contador Público",
        "peda@tecnm.mx": "Licenciatura en Pedagogía",
    }
    for email, carrera in alumnos.items():
        register(c, email=email, full_name=carrera, role="estudiante", organization_id=uni_id, career=carrera)

    h_emp = login(c, "rh@agroempresa.mx")
    ch = c.post(f"{API}/challenges", headers=h_emp, json={
        "title": "Control de costos de cosecha", "summary": "Necesitamos controlar los costos de cada cosecha.",
        "description": "Registramos a mano insumos, jornales y rendimiento de cada parcela.",
        "category": "Agro", "required_disciplines": ["Informático", "Agrónomo", "Contador"], "min_disciplines": 1,
        "publish": True}).json()

    def ids(h):
        return [x["id"] for x in c.get(f"{API}/challenges", headers=h).json()["items"]]

    for email in ["info@tecnm.mx", "agro@tecnm.mx", "conta@tecnm.mx"]:
        h = login(c, email)
        assert ch["id"] in ids(h), email
        assert c.get(f"{API}/challenges/{ch['id']}", headers=h).status_code == 200

    h_peda = login(c, "peda@tecnm.mx")
    assert ch["id"] not in ids(h_peda)
    r = c.get(f"{API}/challenges/{ch['id']}", headers=h_peda)
    assert r.status_code == 403 and "Pedagogía" in r.json()["detail"]
    recs = c.get(f"{API}/recommendations/challenges", headers=h_peda).json()
    assert ch["id"] not in [m["challenge"]["id"] for m in recs]

    # La empresa solo recibe sugerencias de talento de las carreras que pidió
    talent = {m["user"]["career"] for m in c.get(f"{API}/challenges/{ch['id']}/matches/talent", headers=h_emp).json()}
    assert "Licenciatura en Pedagogía" not in talent

    # El catálogo ofrece las carreras para elegirlas en la app
    assert "Licenciatura en Pedagogía" in c.get(f"{API}/catalogs").json()["carreras"]


def test_registro_de_empresa(client):
    c = client
    nueva = {"name": "Tortillería Doña Mari", "type": "empresa", "state": "Estado de México"}
    u = register(c, email="mari@tortilleria.mx", full_name="María López", role="empresa", organization=nueva)
    assert u["organization_id"]
    # Mismo nombre (aunque cambien acentos o mayúsculas): se avisa en vez de duplicarla
    r = c.post(f"{API}/auth/register", json={"email": "otra@x.mx", "password": "Secreta123", "full_name": "Otra",
                                             "role": "empresa", "organization": {**nueva, "name": "tortilleria doña mari"}})
    assert r.status_code == 409 and "Ya existe" in r.json()["detail"]
    # Nadie puede darse de alta como responsable de una empresa ajena
    r = c.post(f"{API}/auth/register", json={"email": "intruso@x.mx", "password": "Secreta123", "full_name": "Intruso",
                                             "role": "empresa", "organization_id": u["organization_id"]})
    assert r.status_code == 422
