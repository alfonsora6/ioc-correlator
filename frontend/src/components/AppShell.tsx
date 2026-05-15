import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
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
    </div>
  );
}
