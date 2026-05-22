import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import { useLocaleStore } from "./i18n";
import { initTheme } from "./store/theme";
import "./index.css";

initTheme();
document.documentElement.lang = useLocaleStore.getState().locale;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster richColors closeButton />
  </StrictMode>,
);
