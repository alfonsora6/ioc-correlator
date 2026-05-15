import axios from "axios";
import { useAuthStore } from "@/store/auth";

const baseURL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshing = false;
let queue: Array<() => void> = [];

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
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = true;
        try {
          const r = await axios.post<{ access_token: string }>(
            `${baseURL}/api/v1/auth/refresh`,
            {},
            { withCredentials: true },
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
