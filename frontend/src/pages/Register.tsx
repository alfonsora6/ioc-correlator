import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function RegisterPage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const setToken = useAuthStore((s) => s.setAccessToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ access_token: string }>("/api/v1/auth/register", {
        email,
        password,
        full_name: fullName,
        tenant_name: tenantName,
      });
      setToken(data.access_token);
      toast.success(t("auth.accountCreated"));
      nav("/");
    } catch {
      toast.error(t("auth.registrationFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader>
          <CardTitle>{t("auth.createWorkspace")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tn">{t("auth.tenantName")}</Label>
              <Input id="tn" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn">{t("auth.fullName")}</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? t("auth.creating") : t("auth.createAccount")}
            </Button>
            <div className="text-center text-sm text-secondary">
              {t("auth.hasAccount")}{" "}
              <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" to="/login">
                {t("auth.signIn")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
