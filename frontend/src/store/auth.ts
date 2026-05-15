import { create } from "zustand";

type AuthState = {
  accessToken: string | null;
  setAccessToken: (t: string | null) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("access_token"),
  setAccessToken: (t) => {
    if (t) localStorage.setItem("access_token", t);
    else localStorage.removeItem("access_token");
    set({ accessToken: t });
  },
  logout: () => {
    localStorage.removeItem("access_token");
    set({ accessToken: null });
  },
}));
