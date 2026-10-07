# Publicar VinculaTec en cirus.online (Windows Server 2022 + Hostinger)

La web se sirve desde el Windows Server 2022 con **IIS**, el dominio lo resuelve el **DNS** (de Hostinger o
el del propio servidor) y los datos viven en la nube, en **Azure Database for PostgreSQL**.

```
 Navegador ── https://cirus.online ──►  Windows Server 2022 (IP pública)
                                         ├─ IIS, sitio "cirus" (C:\inetpub\cirus)
                                         │    ├─ /            → web compilada (Expo, SPA)
                                         │    ├─ /api, /docs  → proxy ARR → 127.0.0.1:8000
                                         │    └─ HTTPS gratis (Let's Encrypt con win-acme, se renueva solo)
                                         ├─ Servicio de Windows "cirus-api" (FastAPI + uvicorn)
                                         │    └─────────────────────────────► Azure PostgreSQL (BD en la nube)
                                         └─ Servidor DNS: zona cirus.online (@, www y, opcional, ns1/ns2)
```

Todo lo hace un solo script: [`windows/desplegar.ps1`](windows/desplegar.ps1). Se puede correr las veces que
quieras; cada vez actualiza el sitio y conserva la configuración (`.env`, certificado).

---

## 1. Antes de empezar

1. **IP pública fija del servidor.** Si la VM está en Azure: *Máquina virtual → Redes → IP pública →
   Configuración → Asignación: **Estática***. Si cambia, el dominio deja de apuntar al servidor.
2. **Firewall de la nube** (el de Windows lo abre el script). En Azure: *Máquina virtual → Redes →
   Agregar regla de puerto de entrada*:
   - TCP **80** y **443** (web y certificado).
   - TCP y UDP **53**, solo si eliges la opción B de DNS (el servidor como DNS del dominio).
3. **Azure PostgreSQL debe aceptar al servidor.** En el portal: *servidor PostgreSQL → Redes → Agregar
   regla de firewall* con la IP pública del Windows Server.
4. Ten a la mano la cadena de conexión (`DATABASE_URL`), la misma de `backend/.env`:
   ```
   postgresql+psycopg://USUARIO:CLAVE@SERVIDOR.postgres.database.azure.com:5432/vinculatec?sslmode=require
   ```

## 2. DNS del dominio en Hostinger

Entra a **hPanel → Dominios → cirus.online → DNS / Nameservers**. Elige **una** de las dos opciones.

### Opción A (recomendada): Hostinger resuelve el dominio y apunta al servidor

En **Registros DNS** deja solo esto para `@` y `www` (borra los registros de "parking" que haya):

| Tipo | Nombre | Apunta a | TTL |
|---|---|---|---|
| A | `@` | IP pública del servidor | 300 |
| A | `www` | IP pública del servidor | 300 |

- **Borra** los registros **AAAA** de `@` y `www` si existen: Let's Encrypt usaría IPv6 y el certificado fallaría.
- Si `www` es un CNAME, bórralo antes de crear el A (no pueden coexistir).
- Los nameservers deben seguir siendo los de Hostinger (p. ej. `ns1.dns-parking.com`, `ns2.dns-parking.com`).

El script igual crea la zona `cirus.online` en el **Servidor DNS de Windows** con los mismos registros: la
usan los equipos de la red interna que tengan este servidor como DNS.

### Opción B: el Windows Server es el DNS del dominio

Así Internet le pregunta a **tu** servidor por `cirus.online`. El servidor debe estar encendido siempre
(si se apaga, el dominio deja de existir) y lo que tuvieras en el DNS de Hostinger (correo, MX, etc.)
hay que crearlo en el DNS de Windows.

1. En **DNS / Nameservers → Nameservers secundarios (child nameservers)** crea:
   - `ns1.cirus.online` → IP pública del servidor
   - `ns2.cirus.online` → la misma IP (Hostinger pide dos)
2. En **Cambiar nameservers → Usar nameservers personalizados** pon `ns1.cirus.online` y `ns2.cirus.online`.
3. Corre el script con `-DnsPublico` (crea ns1/ns2, los registros NS y SOA, abre el puerto 53 y apaga
   la recursión para no ser un DNS abierto).

El cambio de nameservers puede tardar de unas horas hasta 48 h en propagarse.

## 3. Bajar el proyecto al servidor

Con Git:
```powershell
git clone https://github.com/yaelgarpalm/HackatecNM-Regional.git C:\src\HackatecNM-Regional
```
O en GitHub: **Code → Download ZIP**, descomprímelo en `C:\src\HackatecNM-Regional` y desbloquéalo:
```powershell
Get-ChildItem -Recurse C:\src\HackatecNM-Regional | Unblock-File
```

## 4. Correr el script

Abre **PowerShell como Administrador**:
```powershell
cd C:\src\HackatecNM-Regional
powershell -ExecutionPolicy Bypass -File .\deploy\windows\desplegar.ps1 -Correo tu@correo.com
```
Con la opción B de DNS agrega `-DnsPublico`. La primera vez pide la `DATABASE_URL` (no se ve al escribir)
y tarda de 10 a 20 minutos.

| Qué instala | Dónde |
|---|---|
| IIS, URL Rewrite y ARR (proxy inverso) | sitio `cirus` en `C:\inetpub\cirus` |
| Servidor DNS | zona `cirus.online` |
| Python 3.13 y el backend | `C:\cirus\backend` (su `.env` solo lo leen Administradores y SYSTEM) |
| Servicio `cirus-api` (WinSW, arranca con Windows y se reinicia si falla) | `C:\cirus\servicio`, logs en `C:\cirus\logs` |
| Node.js LTS (solo para compilar la web) | `C:\Program Files\nodejs` |
| win-acme (certificado HTTPS y su renovación automática) | `C:\cirus\win-acme` |

Si el DNS público todavía no apunta al servidor, el script deja el sitio en **http** y te avisa; vuelve a
correrlo cuando propague y sacará el certificado (y activará la redirección a https).

## 5. Comprobar

- Web: https://cirus.online y https://www.cirus.online
- API: https://cirus.online/health (debe decir `{"status":"ok"}`) y https://cirus.online/docs
- DNS del servidor: `Resolve-DnsName cirus.online -Server 127.0.0.1`
- DNS público: `Resolve-DnsName cirus.online -Server 8.8.8.8`
- Servicio: `Get-Service cirus-api`

## 6. Actualizar el sitio

```powershell
cd C:\src\HackatecNM-Regional
git pull
powershell -ExecutionPolicy Bypass -File .\deploy\windows\desplegar.ps1
```

## Opciones del script

| Opción | Para qué |
|---|---|
| `-Correo` | Correo para Let's Encrypt (avisos de vencimiento) |
| `-DnsPublico` | Opción B: este servidor es el DNS autoritativo del dominio |
| `-DatabaseUrl "postgresql+psycopg://…"` | No preguntar la conexión (o cambiarla) |
| `-IpPublica 1.2.3.4` | Si no detecta bien la IP pública |
| `-Dominio otro.com` | Usar otro dominio |
| `-BackendAzure` | Solo publica la web y usa el backend que ya está en Azure App Service (no instala Python, ARR ni el servicio). Requiere que el backend de Azure tenga el cambio de CORS de `cirus.online` (se despliega al hacer merge a `main`) |
| `-SinHttps` | No sacar certificado |
| `-SinDns` | No instalar ni tocar el rol DNS |

La app móvil no cambia: sigue usando el backend de Azure App Service. Las dos versiones comparten la misma
base de datos de Azure.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| El script dice "El backend no responde" | Mira `C:\cirus\logs\cirus-api.err.log`. *timeout* → falta la regla de firewall de Azure PostgreSQL para la IP del servidor. *password authentication failed* → `DATABASE_URL` mal escrita (los caracteres `@ : / # ?` de la clave van codificados: `@` → `%40`, `#` → `%23`). Corrígela con `-DatabaseUrl`. |
| `/api/...` da error 502 | El servicio `cirus-api` está detenido: `Start-Service cirus-api` y revisa el log. |
| `remaining connection slots are reserved` | Demasiadas conexiones al plan básico de Azure; ver `backend/README.md`. |
| No sale el certificado | El dominio no apunta aún a la IP (espera la propagación), hay registros AAAA, o el puerto 80 está cerrado en el firewall de la nube. Corrige y vuelve a correr el script. |
| Desde fuera no abre, pero en el servidor sí | Falta abrir 80/443 en el firewall de la nube (en Azure, el grupo de seguridad de red). |
| Error al descargar URL Rewrite o ARR | Instálalos a mano desde iis.net (*URL Rewrite 2.1* y *Application Request Routing 3.0*) y vuelve a correr el script. |
