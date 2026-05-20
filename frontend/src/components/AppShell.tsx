<<<<<<< HEAD
import { useEffect, useState } from "react";
=======
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
<<<<<<< HEAD
  Menu,
  Moon,
  Scan,
  Settings,
  Shield,
  SunMedium,
  Upload,
  FileText,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";

const navKeys: { to: string; key: TranslationKey; icon: typeof LayoutDashboard; end?: boolean }[] = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/analyze", key: "nav.analyze", icon: Scan },
  { to: "/batch", key: "nav.batch", icon: Upload },
  { to: "/api-keys", key: "nav.apiKeys", icon: KeyRound },
  { to: "/reports", key: "nav.reports", icon: FileText },
  { to: "/settings", key: "nav.settings", icon: Settings },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();

  return (
    <nav className="space-y-1">
      {navKeys.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={onNavigate}
          className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
        >
          <l.icon className="h-4 w-4 shrink-0" />
          {t(l.key)}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const nav = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);
=======
  Moon,
  Scan,
  Settings,
  SunMedium,
  Upload,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/analyze", label: "Analyze", icon: Scan },
  { to: "/batch", label: "Batch", icon: Upload },
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const nav = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, [theme]);
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca

  async function onLogout() {
    try {
      await api.post("/api/v1/auth/logout");
    } catch {
      // ignore
    }
    logout();
    nav("/login");
  }

  return (
<<<<<<< HEAD
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-brand-500/8 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[24rem] w-[24rem] rounded-full bg-indigo-500/8 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen">
        <aside
          className="hidden w-64 shrink-0 flex-col border-r border-subtle p-5 md:flex"
          style={{ background: "var(--sidebar-bg)", backdropFilter: "blur(12px)" }}
        >
          <div className="mb-8 flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-primary">{t("app.name")}</div>
              <div className="text-[11px] text-muted">{t("app.tagline")}</div>
            </div>
          </div>

          <SidebarNav />

          <div className="mt-auto space-y-3 border-t border-subtle pt-5">
            <LanguageSelector />
            <Button variant="outline" className="w-full justify-start gap-2" onClick={toggleTheme}>
              {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? t("theme.light") : t("theme.dark")}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-rose-600 hover:text-rose-700 dark:text-rose-300" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              {t("auth.logout")}
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-subtle px-4 py-3 md:hidden"
            style={{ background: "var(--sidebar-bg)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-primary">{t("app.name")}</span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector compact />
              <Button variant="outline" size="sm" onClick={toggleTheme} aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")}>
                {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)} aria-label="Menu">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-subtle p-5 md:hidden"
              style={{ background: "var(--sidebar-bg)", backdropFilter: "blur(16px)" }}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-semibold text-primary">{t("app.name")}</span>
                <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto space-y-2 border-t border-subtle pt-4">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  {t("auth.logout")}
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
=======
    <div
      className={
        theme === "dark"
          ? "min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950 text-slate-100"
          : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-slate-900"
      }
    >
      <div className="flex">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/20 p-4 md:block">
          <div className="mb-8 px-2 text-sm font-semibold tracking-wide text-brand-500">IOC Correlator</div>
          <nav className="space-y-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`
                }
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 space-y-2 px-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
    </div>
  );
}
