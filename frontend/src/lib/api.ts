import axios, { AxiosError } from "axios";
import { useAuthStore } from "@/store/auth";

/**
 * Resolución de API base:
 * - Si VITE_API_URL es URL fija, se usa esa.
 * - Si VITE_API_URL=auto y estamos en :5173, usa el backend en :8000 (modo local/dev).
 * - Si VITE_API_URL=auto y estamos en otro puerto (80/443, proxy), usa mismo origen.
 * VITE_API_URL=auto activa este modo; un URL fijo lo sobreescribe.
 */
export function getApiBaseURL(): string {
  const env = import.meta.env.VITE_API_URL?.trim();
  if (env && env !== "auto") return env.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.hostname) {
    const { protocol, hostname, port } = window.location;
    if (port === "5173") {
      return `${protocol}//${hostname}:8000`;
    }
    return "";
  }
  return "http://127.0.0.1:8000";
}

/** URL base para WebSocket (ws/wss), alineada con getApiBaseURL(). */
export function getWebSocketBaseURL(): string {
  const httpBase = getApiBaseURL();
  if (typeof window === "undefined") {
    return "ws://127.0.0.1:8000";
  }
  if (!httpBase) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  try {
    const url = new URL(httpBase);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return httpBase.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  }
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
      return "El API no respondió con JSON (revisa proxy /api o backend en :8000).";
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
      return "Respuesta inválida del API. Comprueba backend/proxy: docker compose ps y endpoint /health";
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
