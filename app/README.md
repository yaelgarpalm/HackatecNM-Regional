# VinculaTec App — Frontend (Expo · React Native · TypeScript)

Un solo código para **Android, iOS y web**. Consume la API de `vinculatec-backend`.

## Requisitos

- Node.js 20 o superior
- El backend corriendo (`uvicorn app.main:app --reload --host 0.0.0.0` en la carpeta del backend)
- En el celular: la app **Expo Go** (Play Store / App Store)

## Arranque

```bash
npm install
npx expo start
```

- **Web:** presiona `w` (se abre en http://localhost:8081)
- **Celular:** escanea el QR con Expo Go. El celular y la PC deben estar en la **misma red Wi-Fi**.
- **Emulador Android:** presiona `a`

La app detecta sola la IP de tu PC para hablar con el backend (puerto 8000). Si no la encuentra, crea un archivo `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.70:8000
```

(usa la IP de tu PC; en Windows la ves con `ipconfig`). En Windows, si el celular no conecta, permite Python y Node en el firewall.

Cuentas de demo (después de `python seed.py` en el backend): en el login hay botones para llenar cada rol. Contraseña: `Demo12345`.

## Qué incluye (todo el backend)

| Rol | Pantallas |
|---|---|
| Todos | Login, registro (con alta de organización), perfil y edición, notificaciones con contador, indicadores, directorio de organizaciones, portafolio con evaluaciones |
| Estudiante / académico | Retos recomendados con % de afinidad y razones, tablero con filtros, NDA, equipos multidisciplinarios (buscar e invitar por carrera o habilidad, asesor), postulación con validación de carreras, mis postulaciones |
| Empresa / gobierno | Publicar y editar retos (borrador, confidencialidad, PI, modalidades, apoyo económico), cambiar estado, comparar postulaciones con cobertura de disciplinas, aceptar o rechazar, sugerencias de laboratorios y talento |
| Colaboración | Hitos con entregas y aprobación, chat del reto (se actualiza cada 5 s), evaluación mutua con estrellas |
| Universidad | Indicadores de vinculación de su institución, publicar y editar capacidades |
| Admin | Verificar organizaciones |

## Comandos

```bash
npm run typecheck        # revisión de tipos
npx expo lint            # lint
npm run build:web        # genera la versión web estática en dist/ (se puede subir a cualquier hosting)
npx eas-cli build -p android --profile preview   # APK instalable (requiere cuenta gratuita de Expo)
```

Para publicar la web en **cirus.site** (Windows Server 2022 con IIS y DNS), ver [`../deploy/README.md`](../deploy/README.md).

## Estructura

```
src/
  app/                    # rutas (Expo Router): cada archivo es una pantalla
    login.tsx, registro.tsx
    (app)/                # pantallas con sesión
      (tabs)/             # Inicio, Retos, Equipos, Capacidades, Perfil
      reto/[id]/          # detalle, postular, postulaciones, hitos, chat, evaluar, sugerencias
      equipo/[id].tsx, usuario/[id].tsx, publicar.tsx, capacidad.tsx, …
  components/             # UI reutilizable (botones, tarjetas, chips, badges…), hooks de datos
  lib/                    # cliente API con renovación automática de sesión, auth, tipos, formato
```

- Los tokens se guardan cifrados en el celular (`expo-secure-store`) y en `localStorage` en la web.
- Si el access token expira, el cliente usa el refresh token sin pedir contraseña otra vez.
- Los datos se cachean y refrescan con TanStack Query (desliza hacia abajo para recargar).
