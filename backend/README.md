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
                                  # y en .env pon la conexión a Azure PostgreSQL (DATABASE_URL)
uvicorn app.main:app --reload --host 0.0.0.0
```

- Swagger: http://localhost:8000/docs (botón **Authorize** → usuario `ana@tessfp.edu.mx` / `Demo12345`)
- Pruebas: `pytest -q` (usan una base temporal propia; nunca tocan Azure)
- La base de Azure ya tiene datos de demo (contraseña: Demo12345). `python seed.py --borrar-todo` la reinicia **borrando todo**
- Base de datos en la nube (Azure Database for PostgreSQL): ver la sección **Base de datos en Azure** más abajo

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

## Base de datos en Azure

La única base de datos es **Azure Database for PostgreSQL – Flexible Server**. Las pruebas (`pytest`) usan otra base del mismo servidor, `vinculatec_test`, que borran y recrean; nunca tocan `vinculatec`.

1. En el portal de Azure: **Crear un recurso → Azure Database for PostgreSQL → Servidor flexible**.
   - Carga de trabajo: *Desarrollo* (el nivel más barato, Burstable B1ms).
   - Autenticación: *Solo autenticación de PostgreSQL*; anota el usuario administrador y la contraseña.
2. En **Redes**: acceso público y **Agregar la dirección IP del cliente actual** (tu PC). Si el backend se
   publica también en Azure, activa *Permitir el acceso público desde cualquier servicio de Azure*.
3. Cuando termine de crearse, en **Bases de datos → Agregar** crea la base `vinculatec`.
4. En `backend/.env` (no se sube a GitHub) pon la conexión:
   ```
   DATABASE_URL=postgresql+psycopg://USUARIO:CLAVE@NOMBRE-SERVIDOR.postgres.database.azure.com:5432/vinculatec?sslmode=require
   ```
   Si la contraseña tiene `@ : / # ?`, codifícalos (`@` → `%40`, `#` → `%23`).
5. Al arrancar `uvicorn` las tablas se crean solas. Para cargar los datos de demo (borra todo lo que haya):
   `python seed.py --borrar-todo`

### Mapa de universidades (OpenStreetMap)

Cada organización guarda latitud y longitud. Se calculan solas con su ciudad y estado (Nominatim de
OpenStreetMap) al registrarse o al cambiar de ciudad, y se pueden corregir tocando el mapa en "Mi organización".
Para ubicar de una vez las organizaciones que ya existían: `python ubicar.py`.

### Si aparece "remaining connection slots are reserved…"

El plan básico de Azure admite unas 35 conexiones para todo el equipo. Cada backend usa hasta 5, y cada
reinicio de `--reload` puede dejar conexiones huérfanas. La base `vinculatec` las cierra sola tras 5 minutos
de inactividad (`idle_session_timeout`); si urge liberarlas, en el portal de Azure → **Reiniciar** el servidor,
o ejecuta en la base: `select pg_terminate_backend(pid) from pg_stat_activity where usename = current_user and state = 'idle' and pid <> pg_backend_pid();`

## Publicar en cirus.site (Windows Server 2022)

El backend también puede correr como servicio de Windows detrás de IIS, junto con la web, en el dominio
`cirus.site` y usando esta misma base de Azure. Ver [`../deploy/README.md`](../deploy/README.md).

## Frontend

La app (web + Android + iOS con un solo código) está en la carpeta `app/` (junto a esta carpeta `backend/`), hecha con Expo (React Native + TypeScript). Ver su README.

## Siguientes pasos sugeridos

- Migraciones con **Alembic** (hoy se usa `create_all`, suficiente para desarrollo y demo).
- Subida de archivos para entregables (S3 en AWS) y notificaciones push (Firebase Cloud Messaging).
- WebSockets para chat en tiempo real (hoy la app usa *polling* con `after_id`).
- Sustituir el matching por *embeddings* de IA sin cambiar la forma de la respuesta.
