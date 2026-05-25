import axios, { AxiosError } from "axios";
import { useAuthStore } from "@/store/auth";

/**
 * URL del API en el mismo host que el navegador, puerto 8000.
 * Así funciona en Debian al entrar por IP (p. ej. http://192.168.1.10:5173 → API :8000).
 * VITE_API_URL=auto activa este modo; un URL fijo lo sobreescribe.
 */
export function getApiBaseURL(): string {
  const env = import.meta.env.VITE_API_URL?.trim();
  if (env && env !== "auto") return env.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

const baseURL = getApiBaseURL();

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

let refreshing = false;
let queue: Array<() => void> = [];

/** Mensaje legible cuando la API devuelve HTML o JSON inválido (típico "Unexpected token '<'"). */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data;
    if (typeof data === "string" && data.trimStart().startsWith("<")) {
      return "El API no respondió con JSON (¿backend activo en el puerto 8000?).";
    }
    const detail = data && typeof data === "object" && "detail" in data ? (data as { detail: unknown }).detail : undefined;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: string }).msg) : ""))
        .filter(Boolean)
        .join(", ");
    }
    if (err.message.includes("Unexpected token")) {
      return "Respuesta inválida del API. Comprueba: docker compose ps y curl http://TU_IP:8000/health";
    }
  }
  return fallback;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = true;
        try {
          const r = await axios.post<{ access_token: string }>(
            `${baseURL}/api/v1/auth/refresh`,
            {},
            { withCredentials: true, headers: { Accept: "application/json" } },
          );
          useAuthStore.getState().setAccessToken(r.data.access_token);
          refreshing = false;
          queue.forEach((fn) => fn());
          queue = [];
        } catch {
          refreshing = false;
          queue = [];
          useAuthStore.getState().logout();
          window.location.href = "/login";
          return Promise.reject(error);
        }
      }
      return new Promise((resolve) => {
        queue.push(() => resolve(api(original)));
      });
    }
    return Promise.reject(error);
  },
);
