# VinculaTec API — Backend (Python · FastAPI)

Backend único para la plataforma de vinculación **universidad – empresa – gobierno**. Es una API REST (JSON + JWT), así que la misma API la consumen la **web** (React, Vue, Angular…) y la **app móvil** (Flutter, React Native, Kotlin, Swift). Eso es lo que la hace híbrida.

## Cómo resuelve cada causa del problema

| Causa | Qué hace el backend |
|---|---|
| Falta de visibilidad | Catálogo de **capacidades** universitarias (laboratorios, equipo, expertos, servicios) y directorio de organizaciones y talento |
| Sin canal común | **Tablero de retos**: empresas y gobierno publican problemas; los equipos se postulan |
| Burocracia, confidencialidad y PI | NDA con un clic por reto, **modelo de propiedad intelectual** declarado desde la publicación y flujo de estados (sin convenios de meses) |
| Trabajo aislado por carreras | Regla **multidisciplinaria**: el reto exige un mínimo de carreras distintas y se calcula la *cobertura de disciplinas* de cada equipo |
| Desconfianza mutua | Organizaciones **verificadas**, hitos con entregables aprobados, **evaluaciones mutuas** y reputación, y bandera de apoyo económico (`offers_stipend`) |
| Prácticas poco significativas | Cada reto indica si vale como **residencia, servicio social, tesis o proyecto de clase** |
| Emparejamiento lento | **Motor de recomendación** explicable: retos para cada estudiante, y capacidades y talento para cada reto |

## Arranque rápido (Windows / VSCode)

```bash
python -m venv .venv
.venv\Scripts\activate            # en WSL/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # en WSL/Linux: cp .env.example .env
python seed.py                    # datos de demo (contraseña: Demo12345)
uvicorn app.main:app --reload --host 0.0.0.0
```

- Swagger: http://localhost:8000/docs (botón **Authorize** → usuario `ana@tessfp.edu.mx` / `Demo12345`)
- Pruebas: `pytest -q`
- Con PostgreSQL: `docker compose up --build`, o cambia `DATABASE_URL` en `.env` a `postgresql+psycopg://usuario:clave@localhost:5432/vinculatec`

> Para probar desde el celular en la misma red Wi-Fi, usa `--host 0.0.0.0` y apunta la app a `http://<IP-de-tu-PC>:8000`. En el emulador de Android, `localhost` es `10.0.2.2`.

## Roles

`empresa` · `gobierno` publican retos · `universidad` (oficina de vinculación) publica capacidades · `estudiante` y `academico` forman equipos y se postulan · `admin` verifica organizaciones.

## Endpoints principales (`/api/v1`)

| Área | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me` |
| Usuarios | `PATCH /users/me` · `GET /users?q=&career=&role=` · `GET /users/{id}/reviews` · `GET /users/me/notifications` |
| Organizaciones | `GET /organizations` · `PATCH /organizations/{id}` · `POST /organizations/{id}/verify` (admin) |
| Capacidades | `GET /capabilities?q=` · `POST /organizations/{id}/capabilities` · `PUT/DELETE /capabilities/{id}` |
| Retos | `GET /challenges?q=&category=&modality=&state=&mine=` · `POST /challenges` · `GET/PATCH/DELETE /challenges/{id}` · `PATCH /challenges/{id}/status` · `POST /challenges/{id}/nda` |
| Equipos | `POST /teams` · `GET /teams/mine` · `POST /teams/{id}/members` · `DELETE /teams/{id}/members/{uid}` |
| Postulaciones | `GET/POST /challenges/{id}/proposals` · `PATCH /proposals/{id}` (aceptar / rechazar / retirar) · `GET /proposals/mine` |
| Seguimiento | `GET/POST /challenges/{id}/milestones` · `POST /milestones/{id}/deliver` · `POST /milestones/{id}/review` |
| Mensajes | `GET /challenges/{id}/messages?after_id=` · `POST /challenges/{id}/messages` · `GET /challenges/{id}/participants` |
| Evaluaciones | `POST /challenges/{id}/reviews` |
| Recomendaciones | `GET /recommendations/challenges` · `GET /challenges/{id}/matches/capabilities` · `GET /challenges/{id}/matches/talent` |
| Indicadores | `GET /stats` · `GET /stats/university/{id}` · `GET /catalogs` |

Flujo de un reto: `borrador → abierto → en_progreso (al aceptar una propuesta) → finalizado | cancelado`.

## Consumirla desde la web y desde la app

**Web (JavaScript):**
```js
const API = "http://localhost:8000/api/v1";
const { access_token } = await (await fetch(`${API}/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "ana@tessfp.edu.mx", password: "Demo12345" }),
})).json();
const recs = await (await fetch(`${API}/recommendations/challenges`, {
  headers: { Authorization: `Bearer ${access_token}` },
})).json();
```

**App (Flutter / Dart, paquete `http`):**
```dart
final api = 'http://10.0.2.2:8000/api/v1';
final res = await http.post(Uri.parse('$api/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'email': 'ana@tessfp.edu.mx', 'password': 'Demo12345'}));
final token = jsonDecode(res.body)['access_token'];
final retos = await http.get(Uri.parse('$api/challenges'),
    headers: {'Authorization': 'Bearer $token'});
```

La app guarda el `refresh_token` (p. ej., en `flutter_secure_storage`) y llama a `/auth/refresh` cuando el access token expira, para que el usuario no tenga que volver a iniciar sesión.

## Estructura

```
app/
  main.py              # app FastAPI, CORS, GZip, routers
  deps.py              # usuario actual, roles, paginación
  core/                # config (.env), base de datos, seguridad (bcrypt + JWT)
  models/              # entidades SQLAlchemy y enums
  schemas/             # contratos JSON (Pydantic)
  routers/             # auth, users, organizations, challenges, teams, insights
  services/            # matching (recomendaciones) y reglas de dominio
tests/test_flujo.py    # flujo completo de principio a fin
seed.py                # datos de demostración
```

## Frontend

La app (web + Android + iOS con un solo código) está en la carpeta `app/` (junto a esta carpeta `backend/`), hecha con Expo (React Native + TypeScript). Ver su README.

## Siguientes pasos sugeridos

- Migraciones con **Alembic** (hoy se usa `create_all`, suficiente para desarrollo y demo).
- Subida de archivos para entregables (S3 en AWS) y notificaciones push (Firebase Cloud Messaging).
- WebSockets para chat en tiempo real (hoy la app usa *polling* con `after_id`).
- Sustituir el matching por *embeddings* de IA sin cambiar la forma de la respuesta.
