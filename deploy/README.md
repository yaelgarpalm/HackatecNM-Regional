# Publicar VinculaTec en cirus.online (Windows Server 2022 + Hostinger)

La web se sirve desde el Windows Server 2022 con **IIS**, el dominio lo resuelve el **DNS** (de Hostinger o
el del propio servidor) y los datos viven en **PostgreSQL**: en la nube (Azure) o instalado en el mismo
servidor con `-BdLocal` (no necesita cuenta de Azure).

```
 Navegador ── https://cirus.online ──►  Windows Server 2022 (IP pública)
                                         ├─ IIS, sitio "cirus" (C:\inetpub\cirus)
                                         │    ├─ /            → web compilada (Expo, SPA)
                                         │    ├─ /api, /docs  → proxy ARR → 127.0.0.1:8000
                                         │    └─ HTTPS gratis (Let's Encrypt con win-acme, se renueva solo)
                                         ├─ Servicio de Windows "cirus-api" (FastAPI + uvicorn)
                                         │    └──► PostgreSQL local (-BdLocal, 127.0.0.1:5432)
                                         │         o Azure PostgreSQL
                                         └─ Servidor DNS: zona cirus.online (@, www y, opcional, ns1/ns2)
```

Todo lo hace un solo script: [`windows/desplegar.ps1`](windows/desplegar.ps1). Se puede correr las veces que
quieras; cada vez actualiza el sitio y conserva la configuración (`.env`, certificado).

---

## 1. Antes de empezar

### Que el servidor se vea desde Internet

El firewall de Windows lo abre el script; falta lo que está **antes** del servidor:

- **Servidor en casa o en la escuela (detrás de un router):**
  1. En la configuración del router busca *Reenvío de puertos / Port forwarding / Servidor virtual* y
     reenvía **TCP 80** y **TCP 443** a la IP local del servidor (el script la muestra; también con
     `ipconfig`). Con la opción B de DNS, también **TCP y UDP 53**.
  2. Dale al servidor una IP local fija (reserva DHCP en el router) para que el reenvío no se pierda.
  3. Compara la *IP WAN* que muestra el router con la que detecta el script. Si son distintas, o la del
     router empieza con `100.64` a `100.127`, el proveedor usa **CGNAT** y no deja abrir puertos: pide
     una IP pública a tu proveedor de Internet.
  4. Si tu IP pública cambia, hay que actualizar los registros A en Hostinger.
- **VM en la nube (Azure, AWS…):** deja la IP pública como **estática** y abre **TCP 80 y 443** (y 53 con
  la opción B) en el firewall de red de la VM.

### La base de datos

- **Sin Azure (`-BdLocal`):** no necesitas nada. El script instala PostgreSQL 17 en el servidor, crea la
  base `vinculatec` con su propio usuario y contraseña, guarda la conexión en `C:\cirus\backend\.env` y
  carga los datos de demostración (contraseña de esas cuentas: `Demo12345`). PostgreSQL solo acepta
  conexiones del mismo servidor: la página la usa a través del backend y el puerto 5432 no queda
  abierto a Internet.
- **Con Azure PostgreSQL:** ten a la mano la cadena de conexión (`DATABASE_URL`) y agrega la IP pública
  del servidor en *servidor PostgreSQL → Redes → regla de firewall*:
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

Abre **PowerShell como Administrador**. Con la base en el mismo servidor:
```powershell
cd C:\src\HackatecNM-Regional
powershell -ExecutionPolicy Bypass -File .\deploy\windows\desplegar.ps1 -Correo tu@correo.com -BdLocal
```
Con Azure PostgreSQL, quita `-BdLocal`: la primera vez pide la `DATABASE_URL` (no se ve al escribir).
Con la opción B de DNS agrega `-DnsPublico`. La primera vez tarda de 10 a 20 minutos.

| Qué instala | Dónde |
|---|---|
| IIS, URL Rewrite y ARR (proxy inverso) | sitio `cirus` en `C:\inetpub\cirus` |
| Servidor DNS | zona `cirus.online` |
| Python 3.13 y el backend | `C:\cirus\backend` (su `.env` solo lo leen Administradores y SYSTEM) |
| PostgreSQL 17, solo con `-BdLocal` | `C:\Program Files\PostgreSQL\17`; la contraseña del usuario `postgres` queda en `C:\cirus\bd\postgres.txt` (solo Administradores) |
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
- Servicio: `Get-Service cirus-api` (y `Get-Service postgresql*` con `-BdLocal`)

## 6. Actualizar el sitio

```powershell
cd C:\src\HackatecNM-Regional
git pull
powershell -ExecutionPolicy Bypass -File .\deploy\windows\desplegar.ps1
```

## Respaldar la base local

Con `-BdLocal` los datos solo existen en el servidor; respáldalos de vez en cuando:
```powershell
$env:PGPASSWORD = (Get-Content C:\cirus\bd\postgres.txt -Raw).Trim()
& 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe' -h 127.0.0.1 -U postgres -Fc -f "C:\cirus\respaldo-$(Get-Date -Format yyyyMMdd).dump" vinculatec
Remove-Item Env:PGPASSWORD
```
Para restaurar uno: `pg_restore -h 127.0.0.1 -U postgres -d vinculatec --clean C:\cirus\respaldo-AAAAMMDD.dump`.

## Opciones del script

| Opción | Para qué |
|---|---|
| `-Correo` | Correo para Let's Encrypt (avisos de vencimiento) |
| `-DnsPublico` | Opción B: este servidor es el DNS autoritativo del dominio |
| `-BdLocal` | Instalar PostgreSQL en este servidor y usarlo (sin Azure) |
| `-DatabaseUrl "postgresql+psycopg://…"` | Usar Azure u otra base sin que la pregunte (o cambiarla) |
| `-InstaladorPostgres C:\ruta\postgresql-17….exe` | Si no se puede descargar PostgreSQL solo (bájalo de enterprisedb.com) |
| `-ClavePostgres …` | Si PostgreSQL ya estaba instalado antes: contraseña de su usuario `postgres` |
| `-IpPublica 1.2.3.4` | Si no detecta bien la IP pública |
| `-Dominio otro.com` | Usar otro dominio |
| `-BackendAzure` | Solo publica la web y usa el backend que ya está en Azure App Service (no instala Python, ARR ni el servicio). Requiere que el backend de Azure tenga el cambio de CORS de `cirus.online` (se despliega al hacer merge a `main`) |
| `-SinHttps` | No sacar certificado |
| `-SinDns` | No instalar ni tocar el rol DNS |

La app móvil no cambia: sigue usando el backend de Azure App Service. Si la web usa Azure PostgreSQL, las
dos comparten los datos; con `-BdLocal` la web tiene su propia base, separada de la de la app.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| El script dice "El backend no responde" | Mira `C:\cirus\logs\cirus-api.err.log`. *timeout* → falta la regla de firewall de Azure PostgreSQL para la IP del servidor. *password authentication failed* → `DATABASE_URL` mal escrita (los caracteres `@ : / # ?` de la clave van codificados: `@` → `%40`, `#` → `%23`). Corrígela con `-DatabaseUrl`. |
| `/api/...` da error 502 | El servicio `cirus-api` está detenido: `Start-Service cirus-api` y revisa el log. |
| `remaining connection slots are reserved` | Demasiadas conexiones al plan básico de Azure; ver `backend/README.md`. |
| No sale el certificado | El dominio no apunta aún a la IP (espera la propagación), hay registros AAAA, o el puerto 80 está cerrado en el firewall de la nube. Corrige y vuelve a correr el script. |
| Desde fuera no abre, pero en el servidor sí | Falta el reenvío de puertos 80/443 en el router (o abrirlos en el firewall de la nube), o hay CGNAT (ver sección 1). |
| Desde la misma red no abre, pero desde el celular con datos sí | El router no permite entrar a su propia IP pública desde adentro. Usa este servidor como DNS en los equipos de la red: su zona apunta a la IP local. |
| El script dice que no encontró el instalador de PostgreSQL | Descárgalo de enterprisedb.com (Windows x86-64, versión 17) y pásalo con `-InstaladorPostgres`. |
| Error al descargar URL Rewrite o ARR | Instálalos a mano desde iis.net (*URL Rewrite 2.1* y *Application Request Routing 3.0*) y vuelve a correr el script. |
