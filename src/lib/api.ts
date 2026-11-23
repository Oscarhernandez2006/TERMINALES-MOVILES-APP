import axios, { AxiosError } from 'axios';
import { storage } from './storage';

const SERVER_KEY = 'sigpro_api_url';
export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://192.168.1.249/api';

/** Normaliza la URL para que termine en /api, igual que apps/web/src/lib/api.ts. */
export function normalizeApiUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  if (!/\/api$/i.test(url)) url = `${url}/api`;
  return url;
}

export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 15000,
});

export async function loadApiUrl(): Promise<string> {
  const saved = await storage.get(SERVER_KEY);
  const url = saved ? normalizeApiUrl(saved) : normalizeApiUrl(DEFAULT_API_URL);
  api.defaults.baseURL = url;
  return url;
}

export async function saveApiUrl(raw: string): Promise<string> {
  const url = normalizeApiUrl(raw);
  await storage.set(SERVER_KEY, url);
  api.defaults.baseURL = url;
  return url;
}

export function getApiUrl(): string {
  return api.defaults.baseURL ?? DEFAULT_API_URL;
}

/** Verifica que la API y la base de datos respondan (GET /health). */
export async function testApiUrl(raw: string): Promise<void> {
  await axios.get(`${normalizeApiUrl(raw)}/health`, { timeout: 8000 });
}

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    const isCredentialCheck = url.includes('/auth/login') || url.includes('/auth/check-cedula') || url.includes('/auth/verify-admin');
    if (error.response?.status === 401 && !isCredentialCheck) onUnauthorized?.();
    return Promise.reject(error);
  },
);

/** Mensaje legible para el operario a partir de un error de Axios. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ message?: string | string[] }>;
  if (e?.response?.data?.message) {
    const m = e.response.data.message;
    return Array.isArray(m) ? m.join(' · ') : m;
  }
  if (e?.code === 'ECONNABORTED' || e?.message === 'Network Error' || (e?.request && !e?.response)) {
    return 'Sin conexión con el servidor. Verificá la red Wi-Fi o la dirección del servidor.';
  }
  return fallback;
}
