#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Configura la VPN de Windows Server (Enrutamiento y acceso remoto, RRAS) con L2TP/IPsec y clave compartida.

.DESCRIPTION
  Ejecutar en el servidor, como Administrador, desde la carpeta del repositorio:

    powershell -ExecutionPolicy Bypass -File .\deploy\windows\vpn.ps1

  Qué hace (se puede correr de nuevo sin problema):
    1. Instala el rol Acceso remoto (VPN) y configura el servidor VPN.
    2. Los clientes reciben IPs de 10.10.10.2 a 10.10.10.50; dentro de la VPN el servidor es 10.10.10.1.
    3. Activa L2TP/IPsec con una clave compartida aleatoria (queda en C:\cirus\vpn\clave-compartida.txt).
    4. Crea el usuario de Windows para la VPN (vpncirus) y le da permiso de acceso telefónico (dial-in).
    5. Abre UDP 500, 4500 y 1701 en el firewall de Windows y agrega vpn.<dominio> al DNS del servidor.
  Al final muestra los datos y el comando para crear la conexión en una computadora Windows.

.EXAMPLE
  .\deploy\windows\vpn.ps1
.EXAMPLE
  .\deploy\windows\vpn.ps1 -CambiarClave
#>
[CmdletBinding()]
param(
    # Usuario de Windows que se conecta a la VPN
    [string]$Usuario = 'vpncirus',
    [string]$Dominio = 'cirus.site',
    # Rango de IPs de la VPN: la primera es la del servidor, las demás son para los clientes
    [string]$PrimeraIp = '10.10.10.1',
    [string]$UltimaIp = '10.10.10.50',
    [string]$RutaBase = 'C:\cirus',
    # Cambiar la contraseña del usuario de la VPN si ya existe
    [switch]$CambiarClave,
    # Generar otra clave compartida (los clientes tendrán que actualizarla)
    [switch]$NuevaClaveCompartida
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$netsh = "$env:windir\System32\netsh.exe"

function Paso([string]$texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok([string]$texto) { Write-Host "    $texto" -ForegroundColor Green }
function Aviso([string]$texto) { Write-Host "    $texto" -ForegroundColor Yellow }

function Invoke-Netsh {
    # netsh con los argumentos dados; falla si su código de salida no es 0
    param([string[]]$Argumentos)
    $antes = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $salida = & $netsh @Argumentos 2>&1 } finally { $ErrorActionPreference = $antes }
    if ($LASTEXITCODE -ne 0) { throw "Falló: netsh $($Argumentos -join ' '): $salida" }
}

function Write-Utf8([string]$Ruta, [string]$Texto) {
    [IO.File]::WriteAllText($Ruta, $Texto, (New-Object Text.UTF8Encoding $false))
}

function Save-Privado([string]$Ruta, [string]$Texto) {
    # Archivo que solo leen Administradores y SYSTEM
    Write-Utf8 $Ruta $Texto
    icacls $Ruta /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' | Out-Null
}

function New-ClaveCompartida {
    # 24 letras y números, sin los que se confunden (0/O, 1/l/I), fácil de escribir en otro equipo
    $letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'.ToCharArray()
    $bytes = New-Object byte[] 24
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return -join ($bytes | ForEach-Object { $letras[$_ % $letras.Length] })
}

# ---------------------------------------------------------------------------------------------
Paso 'Rol de Acceso remoto (VPN)'
$roles = 'RemoteAccess', 'DirectAccess-VPN', 'Routing'
$faltan = @(Get-WindowsFeature -Name $roles | Where-Object { -not $_.Installed } | ForEach-Object Name)
if ($faltan.Count) {
    $res = Install-WindowsFeature -Name $faltan -IncludeManagementTools
    if (-not $res.Success) { throw "No se pudo instalar: $($faltan -join ', ')" }
    Ok "Instalado: $($faltan -join ', ')"
    if ($res.RestartNeeded -eq 'Yes') {
        Aviso 'Windows pide reiniciar. Reinicia el servidor y vuelve a correr este script.'
        return
    }
} else { Ok 'Ya estaba instalado' }
Import-Module RemoteAccess

$vpnInstalada = $false
try { $vpnInstalada = (Get-RemoteAccess).VpnStatus -eq 'Installed' } catch { }
if (-not $vpnInstalada) {
    Install-RemoteAccess -VpnType Vpn
    Ok 'Servidor VPN configurado'
} else { Ok 'El servidor VPN ya estaba configurado' }

# ---------------------------------------------------------------------------------------------
Paso "IPs de la VPN: servidor $PrimeraIp, clientes hasta $UltimaIp"
# Una red aparte (10.10.10.x) para no chocar con las IPs que reparte el router
try { Invoke-Netsh @('ras', 'ip', 'delete', 'pool') } catch { }
Invoke-Netsh @('ras', 'ip', 'add', 'range', "from=$PrimeraIp", "to=$UltimaIp")
Invoke-Netsh @('ras', 'ip', 'set', 'addrassign', 'method=pool')
Ok 'Rango configurado'

# ---------------------------------------------------------------------------------------------
Paso 'L2TP/IPsec con clave compartida'
$rutaVpn = Join-Path $RutaBase 'vpn'
New-Item -ItemType Directory -Force -Path $rutaVpn | Out-Null
$archivoClave = Join-Path $rutaVpn 'clave-compartida.txt'
if ($NuevaClaveCompartida -or -not (Test-Path $archivoClave)) { Save-Privado $archivoClave (New-ClaveCompartida) }
$claveCompartida = (Get-Content $archivoClave -Raw).Trim()
Set-VpnAuthProtocol -UserAuthProtocolAccepted MsChapv2, EAP -TunnelAuthProtocolsAdvertised PreSharedKey -SharedSecret $claveCompartida
Ok "Clave compartida lista (guardada en $archivoClave)"

# ---------------------------------------------------------------------------------------------
Paso "Usuario de la VPN: $Usuario"
$existe = Get-LocalUser -Name $Usuario -ErrorAction SilentlyContinue
if (-not $existe -or $CambiarClave) {
    Write-Host '    Escribe la contraseña para ese usuario (no se ve al escribir).'
    Write-Host '    Mínimo 8 caracteres con mayúsculas, minúsculas y números.'
    $clave = Read-Host '    Contraseña' -AsSecureString
    try {
        if ($existe) {
            Set-LocalUser -Name $Usuario -Password $clave
            Ok 'Contraseña cambiada'
        } else {
            New-LocalUser -Name $Usuario -Password $clave -FullName 'VPN Cirus' -Description 'Conexión a la VPN del servidor' `
                -PasswordNeverExpires -AccountNeverExpires | Out-Null
            Ok "Usuario $Usuario creado"
        }
    } catch {
        throw "No se pudo poner esa contraseña ($($_.Exception.Message)). Usa una más larga, con mayúsculas, minúsculas y números, y vuelve a correr el script."
    }
} else { Ok "El usuario ya existía (para cambiar su contraseña usa -CambiarClave)" }
# Sin esto la directiva predeterminada de RRAS rechaza la conexión
Invoke-Netsh @('ras', 'set', 'user', "name=$Usuario", 'dialin=permit')
Ok 'Permiso de acceso telefónico (dial-in): permitir'

# ---------------------------------------------------------------------------------------------
Paso 'Firewall de Windows: UDP 500, 4500 y 1701 (IPsec y L2TP)'
foreach ($p in 500, 4500, 1701) {
    if (-not (Get-NetFirewallRule -Name "Cirus-VPN-$p" -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name "Cirus-VPN-$p" -DisplayName "Cirus VPN (UDP $p)" -Direction Inbound -Protocol UDP -LocalPort $p -Action Allow | Out-Null
    }
}
Ok 'Reglas listas'

# ---------------------------------------------------------------------------------------------
$ipLocal = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
        ForEach-Object { $_.IPv4Address.IPAddress })[0]
if ((Get-Command Get-DnsServerZone -ErrorAction SilentlyContinue) -and (Get-DnsServerZone -Name $Dominio -ErrorAction SilentlyContinue)) {
    Paso "DNS del servidor: vpn.$Dominio"
    Get-DnsServerResourceRecord -ZoneName $Dominio -Name 'vpn' -RRType A -ErrorAction SilentlyContinue |
        Remove-DnsServerResourceRecord -ZoneName $Dominio -Force
    Add-DnsServerResourceRecordA -ZoneName $Dominio -Name 'vpn' -IPv4Address $ipLocal -TimeToLive (New-TimeSpan -Minutes 5)
    Ok "A  vpn.$Dominio -> $ipLocal (para los equipos de tu red que usen este servidor como DNS)"
}

Paso 'Reiniciando el servicio de Acceso remoto'
Restart-Service RemoteAccess
Ok "Servicio: $((Get-Service RemoteAccess).Status)"

$ipPublica = $null
try { $ipPublica = (Invoke-RestMethod -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 10).ToString().Trim() } catch { }

# ---------------------------------------------------------------------------------------------
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host ' VPN lista (L2TP/IPsec con clave precompartida)' -ForegroundColor Green
Write-Host " Servidor en tu red:   $ipLocal" -ForegroundColor Green
if ($ipPublica) { Write-Host " Servidor en Internet: $ipPublica (requiere reenviar puertos, ver abajo)" -ForegroundColor Green }
Write-Host " Clave compartida:     $claveCompartida" -ForegroundColor Green
Write-Host " Usuario:              $Usuario (y la contraseña que le pusiste)" -ForegroundColor Green
Write-Host " Dentro de la VPN el servidor es $PrimeraIp  ->  ssh Administrator@$PrimeraIp" -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host ''
Write-Host 'En la computadora Windows que se va a conectar (PowerShell como Administrador):' -ForegroundColor Cyan
Write-Host "  Add-VpnConnection -Name 'VPN Cirus' -ServerAddress '$ipLocal' -TunnelType L2tp -L2tpPsk '$claveCompartida' -AuthenticationMethod MSChapv2 -EncryptionLevel Required -SplitTunneling -RememberCredential -Force"
Write-Host "  rasdial 'VPN Cirus' $Usuario *"
Write-Host ''
Write-Host 'Para conectarte desde Internet (fuera de tu red):' -ForegroundColor Yellow
Write-Host " - En el router reenvía UDP 500 y UDP 4500 a $ipLocal, y usa '$ipPublica' como ServerAddress." -ForegroundColor Yellow
Write-Host ' - Como el servidor está detrás de un router, en la computadora cliente corre una vez y reinicia:' -ForegroundColor Yellow
Write-Host "   New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\PolicyAgent' -Name AssumeUDPEncapsulationContextOnSendRule -Value 2 -PropertyType DWord -Force"
