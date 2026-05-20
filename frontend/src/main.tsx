import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
<<<<<<< HEAD
import { useLocaleStore } from "./i18n";
import { initTheme } from "./store/theme";
import "./index.css";

initTheme();
document.documentElement.lang = useLocaleStore.getState().locale;
=======
import "./index.css";

document.documentElement.classList.add("dark");
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster richColors closeButton />
  </StrictMode>,
);
