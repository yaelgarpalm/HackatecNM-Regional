/** Backend publicado en Azure App Service (usa la base de datos de Azure). */
export const CLOUD_API = 'https://vinculatec-backend-b5befvcybsdwgta3.mexicocentral-01.azurewebsites.net';

/**
 * URL del backend: siempre el de Azure, en web y en el celular.
 * Solo para desarrollar el backend en tu PC se puede cambiar con EXPO_PUBLIC_API_URL en app/.env.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return (fromEnv || CLOUD_API).replace(/\/$/, '');
}

export const API_URL = `${resolveApiUrl()}/api/v1`;
