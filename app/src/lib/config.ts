import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * URL del backend.
 * 1) Si defines EXPO_PUBLIC_API_URL (archivo .env), se usa esa.
 * 2) En el celular con Expo Go se toma la IP de tu PC del servidor de desarrollo.
 * 3) En el emulador de Android, localhost de la PC es 10.0.2.2.
 * 4) En la web, localhost.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (Platform.OS === 'web') return 'http://localhost:8000';

  const hostUri = Constants.expoConfig?.hostUri; // p. ej. "192.168.1.70:8081"
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:8000`;

  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_URL = `${resolveApiUrl()}/api/v1`;
