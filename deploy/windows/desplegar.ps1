#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Publica VinculaTec en un Windows Server 2022 con IIS + DNS, con la base en Azure PostgreSQL o en este
  mismo servidor (PostgreSQL local, opción -BdLocal).

.DESCRIPTION
  Ejecutar en el servidor, como Administrador, desde la carpeta del repositorio:

    powershell -ExecutionPolicy Bypass -File .\deploy\windows\desplegar.ps1 -Correo tu@correo.com

  Qué hace (se puede correr las veces que quieras; cada vez actualiza el sitio):
    1. Instala IIS, URL Rewrite y ARR (proxy inverso) y el rol de Servidor DNS.
    2. Crea la zona DNS del dominio (registros @, www y, con -DnsPublico, ns1/ns2).
    3. Instala Python y el backend FastAPI como servicio de Windows (cirus-api) en 127.0.0.1:8000.
       El backend se conecta a Azure PostgreSQL con el DATABASE_URL que se le pida, o con -BdLocal
       instala PostgreSQL aquí mismo, crea la base y carga los datos de demostración.
    4. Instala Node.js, compila la web (Expo) y la publica en IIS en http://<dominio>.
    5. Si el DNS público ya apunta a este servidor, saca el certificado HTTPS gratis (Let's Encrypt, win-acme)
       y activa la redirección http -> https. Si aún no apunta, vuelve a correr el script cuando propague.

  Con -BackendAzure solo se publica la web: llama al backend que ya está en Azure App Service
  (no instala Python, ARR ni el servicio).

.EXAMPLE
  .\deploy\windows\desplegar.ps1 -Correo yo@correo.com
.EXAMPLE
  .\deploy\windows\desplegar.ps1 -Correo yo@correo.com -BdLocal
.EXAMPLE
  .\deploy\windows\desplegar.ps1 -Correo yo@correo.com -DnsPublico
.EXAMPLE
  .\deploy\windows\desplegar.ps1 -BackendAzure -SinHttps
#>
[CmdletBinding()]
param(
    # Dominio comprado en Hostinger
    [string]$Dominio = 'cirus.site',
    # IP pública del servidor. Si no se da, se detecta sola.
    [string]$IpPublica,
    # Correo para Let's Encrypt (avisos de vencimiento del certificado)
    [string]$Correo,
    # Conexión a Azure PostgreSQL. Si no se da y no existe C:\cirus\backend\.env, se pide en pantalla.
    [string]$DatabaseUrl,
    # Base de datos en este servidor: instala PostgreSQL, crea la base vinculatec y carga los datos de demo
    [switch]$BdLocal,
    # Contraseña del usuario postgres, solo si PostgreSQL ya estaba instalado antes de este script
    [string]$ClavePostgres,
    # Instalador de PostgreSQL ya descargado, si la descarga automática falla
    [string]$InstaladorPostgres,
    # Este servidor será el DNS autoritativo del dominio (nameservers ns1/ns2.<dominio> en Hostinger)
    [switch]$DnsPublico,
    # Solo publicar la web y usar el backend que ya está en Azure App Service
    [switch]$BackendAzure,
    [string]$UrlBackendAzure = 'https://vinculatec-backend-b5befvcybsdwgta3.mexicocentral-01.azurewebsites.net',
    # No intentar sacar el certificado HTTPS
    [switch]$SinHttps,
    # No instalar ni tocar el rol DNS
    [switch]$SinDns,
    [string]$NombreSitio = 'cirus',
    [string]$RutaWeb = 'C:\inetpub\cirus',
    [string]$RutaBase = 'C:\cirus',
    [string]$VersionPython = '3.13.7'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest es mucho más rápido sin barra de progreso
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Descargas = Join-Path $RutaBase 'descargas'
$RutaBackend = Join-Path $RutaBase 'backend'
$RutaServicio = Join-Path $RutaBase 'servicio'
$RutaLogs = Join-Path $RutaBase 'logs'
$RutaWacs = Join-Path $RutaBase 'win-acme'
$Servicio = 'cirus-api'
$PuertoApi = 8000
$Hosts = @($Dominio, "www.$Dominio")

function Paso([string]$texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok([string]$texto) { Write-Host "    $texto" -ForegroundColor Green }
function Aviso([string]$texto) { Write-Host "    $texto" -ForegroundColor Yellow }

function Invoke-Nativo {
    # Ejecuta un programa y falla si su código de salida no es 0
    param([string]$Exe, [string[]]$Argumentos)
    # En Windows PowerShell 5.1 (ISE, sesiones remotas) lo que un programa escribe en stderr se vuelve
    # un error que detendría el script; aquí solo cuenta el código de salida
    $antes = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Exe @Argumentos } finally { $ErrorActionPreference = $antes }
    if ($LASTEXITCODE -ne 0) { throw "Falló: $Exe $($Argumentos -join ' ') (código $LASTEXITCODE)" }
}

function Get-Archivo([string]$Url, [string]$Nombre) {
    New-Item -ItemType Directory -Force -Path $Descargas | Out-Null
    $destino = Join-Path $Descargas $Nombre
    if (-not (Test-Path $destino)) {
        Write-Host "    Descargando $Url"
        try {
            Invoke-WebRequest -Uri $Url -OutFile "$destino.tmp" -UseBasicParsing
        } catch {
            throw "No se pudo descargar $Url ($($_.Exception.Message)). Descárgalo a mano y ponlo en $destino"
        }
        Move-Item "$destino.tmp" $destino
    }
    return $destino
}

function Install-Msi([string]$Msi) {
    $p = Start-Process msiexec.exe -ArgumentList @('/i', "`"$Msi`"", '/qn', '/norestart') -Wait -PassThru
    # 1638 = ya estaba instalada otra versión; 3010 = pide reiniciar
    if ($p.ExitCode -notin 0, 1638, 3010) { throw "Falló la instalación de $Msi (código $($p.ExitCode))" }
}

function Update-Path {
    # Toma el PATH recién modificado por los instaladores sin abrir otra consola
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Write-Utf8([string]$Ruta, [string]$Texto) {
    # Sin BOM: pydantic-settings no reconoce la primera variable del .env si el archivo trae BOM
    [IO.File]::WriteAllText($Ruta, $Texto, (New-Object Text.UTF8Encoding $false))
}

function New-Secreto {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-Clave {
    # Solo letras, números, - y _ (sirve en la URL de conexión, en SQL y en la línea de comandos);
    # empieza con letra para que ningún instalador la confunda con una opción
    return 'k' + (New-Secreto)
}

function Save-Privado([string]$Ruta, [string]$Texto) {
    # Archivo que solo leen Administradores y SYSTEM
    Write-Utf8 $Ruta $Texto
    icacls $Ruta /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' | Out-Null
}

function Find-InstaladorPostgres {
    # EDB publica los instaladores como postgresql-17.<menor>-<compilación>-windows-x64.exe; busca el más nuevo
    foreach ($menor in 20..0) {
        foreach ($compilacion in 3..1) {
            $nombre = "postgresql-17.$menor-$compilacion-windows-x64.exe"
            $url = "https://get.enterprisedb.com/postgresql/$nombre"
            try {
                $r = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 15
                if ($r.StatusCode -eq 200) { return @{ Url = $url; Nombre = $nombre } }
            } catch { }
        }
    }
    throw ('No encontré el instalador de PostgreSQL 17. Descárgalo de ' +
        'https://www.enterprisedb.com/downloads/postgres-postgresql-downloads (Windows x86-64, versión 17) ' +
        'y vuelve a correr el script con -InstaladorPostgres C:\ruta\al\instalador.exe')
}

function Invoke-Psql([string]$Sql) {
    # Ejecuta una instrucción como el usuario postgres y devuelve el resultado sin formato
    $antes = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $env:PGPASSWORD = $ClavePostgres
    try {
        $salida = & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -tAc $Sql
        if ($LASTEXITCODE -ne 0) { throw "psql falló: $($Sql -replace "PASSWORD '[^']*'", "PASSWORD '***'")" }
        return "$salida".Trim()
    } finally {
        $ErrorActionPreference = $antes
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Wait-Postgres {
    for ($i = 0; $i -lt 30; $i++) {
        try { if ((Invoke-Psql 'SELECT 1') -eq '1') { return } } catch { }
        Start-Sleep -Seconds 2
    }
    throw 'PostgreSQL no responde en 127.0.0.1:5432'
}

function Stop-Backend {
    # Detiene el backend para actualizarlo. Lo deshabilita mientras tanto: el servicio está configurado
    # para reiniciarse solo si falla, y no debe volver a arrancar a la mitad de la copia.
    if (-not (Get-Service $Servicio -ErrorAction SilentlyContinue)) { return }
    Set-Service $Servicio -StartupType Disabled
    try {
        Stop-Service $Servicio -Force -ErrorAction Stop
    } catch {
        Aviso "El servicio no se detuvo normalmente ($($_.Exception.Message)); lo cierro a la fuerza"
    }
    $pidServicio = (Get-CimInstance Win32_Service -Filter "Name='$Servicio'").ProcessId
    if ($pidServicio) { Stop-Process -Id $pidServicio -Force -ErrorAction SilentlyContinue }
    # El python del entorno virtual lanza otro python; se buscan los dos por su línea de comandos
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -like '*uvicorn app.main:app*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}

function Wait-Url([string]$Url, [string]$HostHeader, [int]$Segundos = 90) {
    # Espera a que la URL conteste (2xx o redirección). HttpWebRequest deja fijar el Host
    # para probar el sitio de IIS aunque el dominio todavía no resuelva a este servidor.
    $limite = (Get-Date).AddSeconds($Segundos)
    do {
        try {
            $req = [Net.HttpWebRequest]::Create($Url)
            $req.Timeout = 10000
            $req.AllowAutoRedirect = $false
            if ($HostHeader) { $req.Host = $HostHeader }
            $res = $req.GetResponse()
            $codigo = [int]$res.StatusCode
            $res.Close()
            if ($codigo -lt 400) { return $true }
        } catch { }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $limite)
    return $false
}

function Get-IpDnsPublico([string]$Nombre) {
    # Pregunta al DNS público de Google (por HTTPS, funciona aunque el puerto 53 de salida esté cerrado)
    try {
        $r = Invoke-RestMethod -Uri "https://dns.google/resolve?name=$Nombre&type=A" -UseBasicParsing -TimeoutSec 15
        return @($r.Answer | Where-Object { $_.type -eq 1 } | ForEach-Object { $_.data })
    } catch { return @() }
}

function Get-TieneAaaa([string]$Nombre) {
    try {
        $r = Invoke-RestMethod -Uri "https://dns.google/resolve?name=$Nombre&type=AAAA" -UseBasicParsing -TimeoutSec 15
        return [bool]($r.Answer | Where-Object { $_.type -eq 28 })
    } catch { return $false }
}

Write-Host "Repositorio: $Repo"
Write-Host "Dominio:     $Dominio (y www.$Dominio)"
Write-Host "Backend:     $(if ($BackendAzure) { "Azure App Service ($UrlBackendAzure)" } else { "este servidor (servicio $Servicio)" })"
Write-Host "Base:        $(if ($BdLocal) { 'PostgreSQL en este servidor' } elseif ($BackendAzure) { 'la del backend de Azure' } else { 'Azure PostgreSQL' })"
if ($BdLocal -and $BackendAzure) { throw '-BdLocal y -BackendAzure no se pueden usar juntos' }

if (-not (Test-Path (Join-Path $Repo 'app\package.json')) -or -not (Test-Path (Join-Path $Repo 'backend\requirements.txt'))) {
    throw "No encuentro app\ y backend\ en $Repo. Corre el script desde la copia del repositorio."
}
New-Item -ItemType Directory -Force -Path $RutaBase, $Descargas, $RutaLogs | Out-Null

# ---------------------------------------------------------------------------------------------
Paso 'IP pública'
if (-not $IpPublica) {
    foreach ($u in 'https://api.ipify.org', 'https://ifconfig.me/ip', 'https://icanhazip.com') {
        try { $IpPublica = (Invoke-RestMethod -Uri $u -UseBasicParsing -TimeoutSec 10).ToString().Trim(); break } catch { }
    }
}
if ($IpPublica -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw 'No pude detectar la IP pública. Pásala con -IpPublica 1.2.3.4' }
Ok "IP pública: $IpPublica"
$ipLocal = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
        ForEach-Object { $_.IPv4Address.IPAddress })[0]
$detrasDeNat = $IpPublica -notin @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object IPAddress)
if ($detrasDeNat) {
    Aviso "Este equipo sale a Internet a través de un router o NAT (su IP en la red local es $ipLocal)."
    Aviso 'Para que lo vean desde Internet hay que reenviar puertos hacia esa IP (ver el resumen al final).'
}

# ---------------------------------------------------------------------------------------------
Paso "Roles de Windows: IIS$(if (-not $SinDns) { ' y Servidor DNS' })"
$roles = @('Web-Server', 'Web-Static-Content', 'Web-Default-Doc', 'Web-Http-Errors', 'Web-Http-Logging',
    'Web-Stat-Compression', 'Web-Dyn-Compression', 'Web-Filtering', 'Web-Mgmt-Console', 'Web-Scripting-Tools')
if (-not $SinDns) { $roles += 'DNS', 'RSAT-DNS-Server' }
$faltan = @(Get-WindowsFeature -Name $roles | Where-Object { -not $_.Installed } | ForEach-Object Name)
if ($faltan.Count) {
    $res = Install-WindowsFeature -Name $faltan -IncludeManagementTools
    if (-not $res.Success) { throw "No se pudieron instalar: $($faltan -join ', ')" }
    if ($res.RestartNeeded -eq 'Yes') { Aviso 'Windows pide reiniciar; termina el script y reinicia después.' }
    Ok "Instalado: $($faltan -join ', ')"
} else { Ok 'Ya estaban instalados' }
Import-Module WebAdministration

# ---------------------------------------------------------------------------------------------
Paso "Módulos de IIS: URL Rewrite$(if (-not $BackendAzure) { ' y Application Request Routing (proxy)' })"
if (-not (Test-Path "$env:windir\System32\inetsrv\rewrite.dll")) {
    Install-Msi (Get-Archivo 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi' 'rewrite_amd64_en-US.msi')
    Ok 'URL Rewrite instalado'
} else { Ok 'URL Rewrite ya estaba' }

if (-not $BackendAzure) {
    if (-not (Test-Path "$env:windir\System32\inetsrv\config\schema\arr_schema.xml")) {
        Install-Msi (Get-Archivo 'https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi' 'requestRouter_amd64.msi')
        Ok 'ARR instalado'
    } else { Ok 'ARR ya estaba' }
    # Activa el proxy de ARR, conserva el Host original y permite mandar X-Forwarded-Proto al backend.
    # Con appcmd (proceso nuevo) porque esta sesión de PowerShell no ve las secciones de módulos recién instalados.
    $appcmd = "$env:windir\System32\inetsrv\appcmd.exe"
    Invoke-Nativo $appcmd @('set', 'config', '-section:system.webServer/proxy', '/enabled:True',
        '/preserveHostHeader:True', '/reverseRewriteHostInResponseHeaders:False', '/commit:apphost')
    $permitidas = (& $appcmd list config -section:system.webServer/rewrite/allowedServerVariables) -join "`n"
    if ($permitidas -notmatch 'HTTP_X_FORWARDED_PROTO') {
        Invoke-Nativo $appcmd @('set', 'config', '-section:system.webServer/rewrite/allowedServerVariables',
            "/+[name='HTTP_X_FORWARDED_PROTO']", '/commit:apphost')
    }
    Ok 'Proxy inverso activado'
}

# ---------------------------------------------------------------------------------------------
if (-not $SinDns) {
    Paso "Servidor DNS: zona $Dominio"
    Import-Module DnsServer
    $esDc = (Get-CimInstance Win32_ComputerSystem).DomainRole -ge 4
    if (-not (Get-DnsServerZone -Name $Dominio -ErrorAction SilentlyContinue)) {
        if ($esDc) {
            Add-DnsServerPrimaryZone -Name $Dominio -ReplicationScope Domain -DynamicUpdate None
        } else {
            Add-DnsServerPrimaryZone -Name $Dominio -ZoneFile "$Dominio.dns" -DynamicUpdate None
        }
        Ok "Zona $Dominio creada"
    } else { Ok "La zona $Dominio ya existía" }

    function Set-RegistroA([string]$Nombre, [string]$Ip) {
        Get-DnsServerResourceRecord -ZoneName $Dominio -Name $Nombre -RRType A -ErrorAction SilentlyContinue |
            Remove-DnsServerResourceRecord -ZoneName $Dominio -Force
        Add-DnsServerResourceRecordA -ZoneName $Dominio -Name $Nombre -IPv4Address $Ip -TimeToLive (New-TimeSpan -Minutes 5)
    }
    # Detrás de un router, los equipos de la red que usen este DNS deben llegar a la IP local
    # (muchos routers no permiten entrar a su propia IP pública desde adentro). Internet usa el DNS de Hostinger.
    $ipZona = if ($DnsPublico -or -not $detrasDeNat -or -not $ipLocal) { $IpPublica } else { $ipLocal }
    Set-RegistroA '@' $ipZona
    Set-RegistroA 'www' $ipZona
    Ok "A  $Dominio -> $ipZona"
    Ok "A  www.$Dominio -> $ipZona"

    if ($DnsPublico) {
        # Este servidor contesta por el dominio en Internet: ns1 y ns2 (Hostinger pide dos) apuntan aquí
        Set-RegistroA 'ns1' $IpPublica
        Set-RegistroA 'ns2' $IpPublica
        $ns = @("ns1.$Dominio.", "ns2.$Dominio.")
        foreach ($n in $ns) {
            if (-not (Get-DnsServerResourceRecord -ZoneName $Dominio -Name '@' -RRType NS | Where-Object { $_.RecordData.NameServer -eq $n })) {
                Add-DnsServerResourceRecord -ZoneName $Dominio -Name '@' -NS -NameServer $n
            }
        }
        Get-DnsServerResourceRecord -ZoneName $Dominio -Name '@' -RRType NS |
            Where-Object { $_.RecordData.NameServer -notin $ns } |
            Remove-DnsServerResourceRecord -ZoneName $Dominio -Force
        $soa = Get-DnsServerResourceRecord -ZoneName $Dominio -Name '@' -RRType SOA
        if ($soa.RecordData.PrimaryServer -ne "ns1.$Dominio.") {
            $nuevo = $soa.Clone()
            $nuevo.RecordData.PrimaryServer = "ns1.$Dominio."
            Set-DnsServerResourceRecord -ZoneName $Dominio -OldInputObject $soa -NewInputObject $nuevo
        }
        Ok "NS ns1.$Dominio y ns2.$Dominio -> $IpPublica"
        if ($esDc) {
            Aviso 'Este servidor es controlador de dominio: dejo la recursión activa (la usan los equipos del dominio).'
            Aviso 'Para no ser un DNS abierto en Internet, en el firewall de la nube permite el puerto 53 solo si lo necesitas.'
        } else {
            # Un DNS público con recursión es un "resolver abierto" que se usa para ataques; solo contesta por sus zonas
            Set-DnsServerRecursion -Enable $false
            Ok 'Recursión desactivada (solo contesta por sus propias zonas)'
        }
        foreach ($proto in 'UDP', 'TCP') {
            if (-not (Get-NetFirewallRule -Name "Cirus-DNS-$proto" -ErrorAction SilentlyContinue)) {
                New-NetFirewallRule -Name "Cirus-DNS-$proto" -DisplayName "Cirus DNS ($proto 53)" -Direction Inbound -Protocol $proto -LocalPort 53 -Action Allow | Out-Null
            }
        }
    }
    Clear-DnsServerCache -Force -ErrorAction SilentlyContinue
    $local = @(Resolve-DnsName -Name $Dominio -Server 127.0.0.1 -Type A -DnsOnly -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq 'A' } | ForEach-Object IPAddress)
    if ($local -contains $ipZona) { Ok "El DNS de este servidor ya resuelve $Dominio -> $ipZona" } else { Aviso "El DNS local aún no resuelve $Dominio" }
}

# ---------------------------------------------------------------------------------------------
Paso 'Firewall de Windows: puertos 80 y 443'
foreach ($p in 80, 443) {
    if (-not (Get-NetFirewallRule -Name "Cirus-HTTP-$p" -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name "Cirus-HTTP-$p" -DisplayName "Cirus web (TCP $p)" -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null
    }
}
Ok 'Reglas listas (si la VM está en Azure/AWS/otra nube, abre también 80 y 443 en su firewall de red)'

# ---------------------------------------------------------------------------------------------
if (-not $BackendAzure) {
    Paso 'Python'
    $python = $null
    foreach ($c in @(@{ Exe = 'py'; Args = @('-3') }, @{ Exe = 'python'; Args = @() })) {
        try {
            $v = & $c.Exe @($c.Args + @('-c', 'import sys; print(sys.version_info >= (3, 10))'))
            if ($LASTEXITCODE -eq 0 -and "$v".Trim() -eq 'True') { $python = $c; break }
        } catch { }
    }
    if (-not $python) {
        $exe = Get-Archivo "https://www.python.org/ftp/python/$VersionPython/python-$VersionPython-amd64.exe" "python-$VersionPython-amd64.exe"
        $p = Start-Process $exe -ArgumentList '/quiet', 'InstallAllUsers=1', 'PrependPath=1', 'Include_launcher=1', 'Include_test=0' -Wait -PassThru
        if ($p.ExitCode -notin 0, 3010) { throw "Falló la instalación de Python (código $($p.ExitCode))" }
        Update-Path
        $python = @{ Exe = 'py'; Args = @('-3') }
        Ok "Python $VersionPython instalado"
    } else { Ok "Usando: $($python.Exe) $($python.Args -join ' ')" }

    Paso "Backend en $RutaBackend"
    $winsw = Join-Path $RutaServicio "$Servicio.exe"
    Stop-Backend
    # Copia el código (sin el entorno virtual ni el .env, que se quedan en el servidor)
    robocopy (Join-Path $Repo 'backend') $RutaBackend /MIR /NFL /NDL /NJH /NJS /NP /XD .venv __pycache__ .pytest_cache /XF .env *.db | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy falló copiando el backend (código $LASTEXITCODE)" }

    $venvPy = Join-Path $RutaBackend '.venv\Scripts\python.exe'
    if (-not (Test-Path $venvPy)) {
        Invoke-Nativo $python.Exe @($python.Args + @('-m', 'venv', (Join-Path $RutaBackend '.venv')))
    }
    Invoke-Nativo $venvPy @('-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '--upgrade', 'pip')
    Invoke-Nativo $venvPy @('-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '-r', (Join-Path $RutaBackend 'requirements.txt'))
    Ok 'Dependencias instaladas'

    $envFile = Join-Path $RutaBackend '.env'
    $sembrar = $false
    if ($BdLocal) {
        Paso 'Base de datos local: PostgreSQL'
        $rutaBd = Join-Path $RutaBase 'bd'
        New-Item -ItemType Directory -Force -Path $rutaBd | Out-Null
        $archivoClavePg = Join-Path $rutaBd 'postgres.txt'
        if (-not $ClavePostgres -and (Test-Path $archivoClavePg)) { $ClavePostgres = (Get-Content $archivoClavePg -Raw).Trim() }

        $servicioPg = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $servicioPg) {
            if (-not $ClavePostgres) { $ClavePostgres = New-Clave }
            # Se guarda antes de instalar para no perderla si algo falla después
            Save-Privado $archivoClavePg $ClavePostgres
            if (-not $InstaladorPostgres) {
                $i = Find-InstaladorPostgres
                $InstaladorPostgres = Get-Archivo $i.Url $i.Nombre
            }
            Write-Host '    Instalando PostgreSQL (tarda unos minutos)...'
            $p = Start-Process $InstaladorPostgres -Wait -PassThru -ArgumentList @('--mode', 'unattended',
                '--unattendedmodeui', 'none', '--superpassword', $ClavePostgres, '--serverport', '5432',
                '--disable-components', 'pgAdmin,stackbuilder')
            if ($p.ExitCode -ne 0) { throw "Falló la instalación de PostgreSQL (código $($p.ExitCode)). Revisa $env:TEMP\install-postgresql.log" }
            $servicioPg = Get-Service -Name 'postgresql*' | Select-Object -First 1
            Ok "PostgreSQL instalado (servicio $($servicioPg.Name))"
        } else {
            if (-not $ClavePostgres) {
                throw "PostgreSQL ya estaba instalado ($($servicioPg.Name)). Pasa la contraseña del usuario postgres con -ClavePostgres"
            }
            Save-Privado $archivoClavePg $ClavePostgres
            Ok "PostgreSQL ya estaba instalado ($($servicioPg.Name))"
        }
        if ($servicioPg.Status -ne 'Running') { Start-Service $servicioPg.Name }
        $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
            Sort-Object { $_.Directory.Parent.Name -as [int] } -Descending | Select-Object -First 1 -ExpandProperty FullName
        if (-not $psql) { throw 'No encuentro psql.exe en C:\Program Files\PostgreSQL' }
        Wait-Postgres

        # Solo acepta conexiones de este mismo servidor: la base no queda abierta a Internet
        if ((Invoke-Psql 'SHOW listen_addresses') -ne 'localhost') {
            Invoke-Psql "ALTER SYSTEM SET listen_addresses = 'localhost'" | Out-Null
            Restart-Service $servicioPg.Name
            Wait-Postgres
        }
        Ok 'PostgreSQL escucha solo en este servidor (puerto 5432 cerrado hacia afuera)'

        $existeBd = (Invoke-Psql "SELECT 1 FROM pg_database WHERE datname = 'vinculatec'") -eq '1'
        $envUsaLocal = (Test-Path $envFile) -and [bool]((Get-Content $envFile) -match '^DATABASE_URL=postgresql\+psycopg://vinculatec:[^@]+@127\.0\.0\.1:')
        if ($existeBd -and $envUsaLocal) {
            Ok 'La base vinculatec ya existía y el backend ya la usa'
        } else {
            $claveApp = New-Clave
            if ((Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname = 'vinculatec'") -eq '1') {
                Invoke-Psql "ALTER ROLE vinculatec WITH LOGIN PASSWORD '$claveApp'" | Out-Null
            } else {
                Invoke-Psql "CREATE ROLE vinculatec WITH LOGIN PASSWORD '$claveApp'" | Out-Null
            }
            if (-not $existeBd) {
                Invoke-Psql "CREATE DATABASE vinculatec OWNER vinculatec ENCODING 'UTF8' TEMPLATE template0" | Out-Null
                Ok 'Base vinculatec creada (usuario vinculatec)'
            }
            $DatabaseUrl = "postgresql+psycopg://vinculatec:$claveApp@127.0.0.1:5432/vinculatec?sslmode=disable"
        }
        $sembrar = -not (Test-Path (Join-Path $rutaBd 'datos-demo.ok'))
    }

    if ($DatabaseUrl -or -not (Test-Path $envFile)) {
        if (-not $DatabaseUrl) {
            Write-Host '    Pega la conexión a Azure PostgreSQL (no se muestra al escribir):'
            Write-Host '    postgresql+psycopg://USUARIO:CLAVE@SERVIDOR.postgres.database.azure.com:5432/vinculatec?sslmode=require'
            $seguro = Read-Host '    DATABASE_URL' -AsSecureString
            $DatabaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))
        }
        if ($DatabaseUrl -notmatch '^postgresql') { throw 'DATABASE_URL debe empezar con postgresql+psycopg://' }
        $secreto = $null
        if (Test-Path $envFile) {
            $secreto = (Get-Content $envFile | Where-Object { $_ -match '^SECRET_KEY=' } | Select-Object -First 1) -replace '^SECRET_KEY=', ''
        }
        if (-not $secreto) { $secreto = New-Secreto }
        $origenes = ($Hosts | ForEach-Object { "`"https://$_`",`"http://$_`"" }) -join ','
        Write-Utf8 $envFile (@(
            "DATABASE_URL=$DatabaseUrl",
            "SECRET_KEY=$secreto",
            'DEBUG=false',
            "CORS_ORIGINS=[$origenes]"
        ) -join "`r`n")
        # Solo Administradores y SYSTEM pueden leer la contraseña de la base
        icacls $envFile /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' | Out-Null
        Ok '.env escrito'
    } else { Ok '.env ya existía (se conserva)' }

    if ($sembrar) {
        Write-Host '    Cargando datos de demostración (contraseña de esas cuentas: Demo12345)...'
        Push-Location $RutaBackend
        try { Invoke-Nativo $venvPy @('seed.py', '--borrar-todo') } finally { Pop-Location }
        Write-Utf8 (Join-Path $RutaBase 'bd\datos-demo.ok') (Get-Date -Format s)
        Ok 'Datos de demostración cargados'
    }

    Paso "Servicio de Windows $Servicio"
    New-Item -ItemType Directory -Force -Path $RutaServicio | Out-Null
    if (-not (Test-Path $winsw)) {
        Copy-Item (Get-Archivo 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' 'WinSW-x64.exe') $winsw
    }
    $xml = @"
<service>
  <id>$Servicio</id>
  <name>Cirus API (VinculaTec)</name>
  <description>Backend FastAPI de VinculaTec para $Dominio. Base de datos: Azure PostgreSQL.</description>
  <executable>$venvPy</executable>
  <arguments>-m uvicorn app.main:app --host 127.0.0.1 --port $PuertoApi --proxy-headers --forwarded-allow-ips 127.0.0.1</arguments>
  <workingdirectory>$RutaBackend</workingdirectory>
  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="10 sec" />
  <resetfailure>1 hour</resetfailure>
  <env name="PYTHONUNBUFFERED" value="1" />
  <logpath>$RutaLogs</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
</service>
"@
    Set-Content -Path (Join-Path $RutaServicio "$Servicio.xml") -Value $xml -Encoding UTF8
    # WinSW lee el XML cada vez que arranca el servicio: basta con instalarlo una vez y reiniciarlo
    if (-not (Get-Service $Servicio -ErrorAction SilentlyContinue)) { Invoke-Nativo $winsw @('install') }
    $ocupado = Get-NetTCPConnection -LocalPort $PuertoApi -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ocupado) {
        Aviso "Otro programa ya usa el puerto $PuertoApi`: $((Get-Process -Id $ocupado.OwningProcess -ErrorAction SilentlyContinue).ProcessName) (PID $($ocupado.OwningProcess)). Ciérralo o el backend no podrá arrancar."
    }
    Set-Service $Servicio -StartupType Automatic
    Start-Service $Servicio
    if (Wait-Url "http://127.0.0.1:$PuertoApi/health") {
        Ok "Backend respondiendo en http://127.0.0.1:$PuertoApi"
    } else {
        Aviso "El backend no responde. Últimas líneas de $RutaLogs\$Servicio.err.log:"
        $logError = Join-Path $RutaLogs "$Servicio.err.log"
        if (Test-Path $logError) { Get-Content $logError -Tail 15 | ForEach-Object { Write-Host "      $_" } }
        Aviso 'Causas típicas: DATABASE_URL mal escrita o la base no acepta la conexión (en Azure: su firewall no permite la IP de este servidor).'
    }
}

# ---------------------------------------------------------------------------------------------
Paso 'Node.js y compilación de la web'
Update-Path
$nodeOk = $false
try { $nodeOk = [int]((& node --version) -replace '^v(\d+).*', '$1') -ge 20 } catch { }
if (-not $nodeOk) {
    # La lista viene de la más nueva a la más vieja; la primera con "lts" es la LTS actual
    $versiones = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
    $lts = $null
    foreach ($v in $versiones) { if ($v.lts) { $lts = $v; break } }
    Install-Msi (Get-Archivo "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-x64.msi" "node-$($lts.version)-x64.msi")
    Update-Path
    Ok "Node.js $($lts.version) instalado"
} else { Ok "Node.js $(& node --version)" }

$rutaApp = Join-Path $Repo 'app'
# "/" = la web llama a /api/v1 en su mismo dominio (IIS lo reenvía al backend local)
$env:EXPO_PUBLIC_API_URL = if ($BackendAzure) { $UrlBackendAzure } else { '/' }
$env:CI = '1'
$env:EXPO_NO_TELEMETRY = '1'
Push-Location $rutaApp
try {
    Invoke-Nativo 'npm.cmd' @('ci', '--no-audit', '--no-fund')
    if (Test-Path dist) { Remove-Item dist -Recurse -Force }
    Invoke-Nativo 'npm.cmd' @('run', 'build:web')
} finally {
    Pop-Location
    Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
}
if (-not (Test-Path (Join-Path $rutaApp 'dist\index.html'))) { throw 'La compilación no generó dist\index.html' }
Ok 'Web compilada'

# ---------------------------------------------------------------------------------------------
Paso "Sitio de IIS '$NombreSitio' en $RutaWeb"
New-Item -ItemType Directory -Force -Path $RutaWeb | Out-Null
robocopy (Join-Path $rutaApp 'dist') $RutaWeb /MIR /NFL /NDL /NJH /NJS /NP /XF web.config /XD .well-known | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falló copiando la web (código $LASTEXITCODE)" }
icacls $RutaWeb /grant 'IIS_IUSRS:(OI)(CI)RX' 'IUSR:(OI)(CI)RX' | Out-Null

if (-not (Test-Path "IIS:\AppPools\$NombreSitio")) {
    New-WebAppPool -Name $NombreSitio | Out-Null
}
Set-ItemProperty "IIS:\AppPools\$NombreSitio" -Name managedRuntimeVersion -Value ''   # sin .NET: solo archivos y proxy

if (-not (Get-Website -Name $NombreSitio)) {
    $id = 1 + [int](Get-Website | Measure-Object -Property id -Maximum).Maximum
    New-Website -Name $NombreSitio -Id $id -PhysicalPath $RutaWeb -ApplicationPool $NombreSitio -HostHeader $Dominio -Port 80 | Out-Null
}
Set-ItemProperty "IIS:\Sites\$NombreSitio" -Name physicalPath -Value $RutaWeb

function Get-HostDeBinding($Binding) { return ($Binding.bindingInformation -split ':')[-1] }
# Este sitio atiende solo el dominio configurado: quita los que tuviera de una corrida anterior con otro -Dominio
foreach ($b in @(Get-WebBinding -Name $NombreSitio)) {
    $h = Get-HostDeBinding $b
    if ($h -and $h -notin $Hosts) {
        $b | Remove-WebBinding
        Aviso "Quité $($b.protocol)://$h de este sitio (ya no es el dominio configurado)"
    }
}
# Si otro sitio de IIS atendía este dominio (por ejemplo, una página anterior), ahora lo atiende este.
# Los archivos de ese otro sitio no se tocan.
foreach ($otro in @(Get-Website | Where-Object { $_.Name -ne $NombreSitio })) {
    foreach ($b in @(Get-WebBinding -Name $otro.Name | Where-Object { (Get-HostDeBinding $_) -in $Hosts })) {
        $b | Remove-WebBinding
        Aviso "El sitio '$($otro.Name)' ($($otro.physicalPath)) atendía $($b.protocol)://$(Get-HostDeBinding $b); ahora lo atiende '$NombreSitio'"
    }
}
foreach ($h in $Hosts) {
    if (-not (Get-WebBinding -Name $NombreSitio -Protocol http -HostHeader $h)) {
        New-WebBinding -Name $NombreSitio -Protocol http -Port 80 -HostHeader $h
    }
}

function Set-WebConfig([bool]$ConHttps) {
    $cfg = Get-Content (Join-Path $PSScriptRoot 'web.config') -Raw
    if ($BackendAzure) { $cfg = $cfg -replace '(?s)\s*<!-- API:INICIO -->.*?<!-- API:FIN -->', '' }
    if ($ConHttps) { $cfg = $cfg.Replace('name="HTTPS" enabled="false"', 'name="HTTPS" enabled="true"') }
    Write-Utf8 (Join-Path $RutaWeb 'web.config') $cfg
}
$tieneHttps = [bool](Get-WebBinding -Name $NombreSitio -Protocol https)
Set-WebConfig $tieneHttps
if ((Get-WebAppPoolState -Name $NombreSitio).Value -ne 'Started') { Start-WebAppPool -Name $NombreSitio }
if ((Get-WebsiteState -Name $NombreSitio).Value -ne 'Started') { Start-Website -Name $NombreSitio }

if (Wait-Url 'http://127.0.0.1/' $Dominio 30) { Ok "IIS sirve la web para $Dominio" } else { Aviso "IIS no respondió en http://127.0.0.1/ para $Dominio" }
if (-not $BackendAzure) {
    if (Wait-Url 'http://127.0.0.1/health' $Dominio 30) { Ok 'El proxy /api -> backend funciona' } else { Aviso 'IIS no llega al backend (revisa ARR y el servicio)' }
}

# ---------------------------------------------------------------------------------------------
if (-not $SinHttps) {
    Paso 'Certificado HTTPS (Let''s Encrypt)'
    $listos = @($Hosts | Where-Object { (Get-IpDnsPublico $_) -contains $IpPublica })
    $conAaaa = @($listos | Where-Object { Get-TieneAaaa $_ })
    foreach ($h in $Hosts | Where-Object { $_ -notin $listos }) {
        $ips = Get-IpDnsPublico $h
        Aviso "$h apunta a: $(if ($ips) { $ips -join ', ' } else { '(nada)' }); debe apuntar a $IpPublica"
    }
    if (-not $listos.Count) {
        Aviso 'Configura el DNS en Hostinger (ver deploy\README.md) y vuelve a correr el script cuando propague.'
    } elseif ($conAaaa.Count) {
        Aviso "Hay registros AAAA (IPv6) en: $($conAaaa -join ', '). Bórralos en Hostinger: Let's Encrypt los usaría y fallaría."
    } else {
        $wacs = Join-Path $RutaWacs 'wacs.exe'
        if (-not (Test-Path $wacs)) {
            $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/win-acme/win-acme/releases/latest' -UseBasicParsing -UserAgent 'cirus-deploy'
            $asset = $rel.assets | Where-Object { $_.name -match 'x64\.trimmed\.zip$' } | Select-Object -First 1
            if (-not $asset) { $asset = $rel.assets | Where-Object { $_.name -match 'x64\.pluggable\.zip$' } | Select-Object -First 1 }
            if (-not $asset) { throw 'No encontré el zip de win-acme en GitHub' }
            $zip = Get-Archivo $asset.browser_download_url $asset.name
            Expand-Archive -Path $zip -DestinationPath $RutaWacs -Force
        }
        $siteId = (Get-Website -Name $NombreSitio).id
        if ($listos.Count -lt $Hosts.Count) { Aviso "Saco el certificado solo para: $($listos -join ', '). Vuelve a correr el script cuando los demás apunten aquí." }
        $argsWacs = @('--source', 'iis', '--siteid', "$siteId", '--host', ($listos -join ','),
            '--installation', 'iis', '--accepttos', '--closeonfinish')
        if ($Correo) { $argsWacs += @('--emailaddress', $Correo) }
        $antes = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { & $wacs @argsWacs } finally { $ErrorActionPreference = $antes }
        if (Get-WebBinding -Name $NombreSitio -Protocol https) {
            Set-WebConfig $true
            Ok "HTTPS listo. win-acme renueva el certificado solo (tarea programada)."
        } else {
            Aviso 'No se pudo emitir el certificado. Revisa la salida de win-acme arriba; el sitio sigue en http.'
        }
    }
}

# ---------------------------------------------------------------------------------------------
$https = [bool](Get-WebBinding -Name $NombreSitio -Protocol https)
$url = "$(if ($https) { 'https' } else { 'http' })://$Dominio"
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host " Sitio: $url" -ForegroundColor Green
if (-not $BackendAzure) { Write-Host " API:   $url/docs" -ForegroundColor Green }
Write-Host " Base:  $(if ($BdLocal) { 'PostgreSQL en este servidor (solo accesible desde aquí)' } elseif ($BackendAzure) { 'la del backend de Azure' } else { 'Azure PostgreSQL' })" -ForegroundColor Green
Write-Host " IP:    $IpPublica" -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
if ($detrasDeNat) {
    Write-Host ''
    Write-Host "Para que el sitio se vea desde Internet:" -ForegroundColor Yellow
    Write-Host " - Router de casa o escuela: reenvía los puertos TCP 80 y 443 a $ipLocal$(if ($DnsPublico) { ', y TCP/UDP 53' })." -ForegroundColor Yellow
    Write-Host "   Si la IP WAN que muestra el router no es $IpPublica (o empieza con 100.64 a 100.127)," -ForegroundColor Yellow
    Write-Host '   tu proveedor usa CGNAT y no deja abrir puertos: pídele una IP pública.' -ForegroundColor Yellow
    Write-Host ' - VM en la nube (Azure, AWS...): abre 80 y 443 en el firewall de red de la VM.' -ForegroundColor Yellow
    Write-Host " - En Hostinger, los registros A de @ y www deben apuntar a $IpPublica." -ForegroundColor Yellow
}
