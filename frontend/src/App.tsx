import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AnalyzePage } from "@/pages/Analyze";
import { ApiKeysPage } from "@/pages/ApiKeys";
import { BatchPage } from "@/pages/Batch";
import { DashboardPage } from "@/pages/Dashboard";
import { LoginPage } from "@/pages/Login";
import { RegisterPage } from "@/pages/Register";
import { ReportsPage } from "@/pages/Reports";
import { SettingsPage } from "@/pages/Settings";
import { useAuthStore } from "@/store/auth";

function RequireAuth() {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analyze" element={<AnalyzePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/api-keys" element={<ApiKeysPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
