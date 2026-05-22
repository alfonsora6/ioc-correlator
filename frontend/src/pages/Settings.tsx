import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";

export function SettingsPage() {
  const { t } = useI18n();
  const [me, setMe] = useState<{ tenant_id: string; email: string; full_name: string } | null>(null);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/v1/auth/me");
        setMe(data);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/v1/users/change-password", { current_password: cur, new_password: nw });
      toast.success(t("settings.passwordUpdated"));
      setCur("");
      setNw("");
    } catch {
      toast.error(t("settings.passwordFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("settings.title")}</h1>
        <p className="page-subtitle">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.tenant")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted">{t("settings.tenantId")}:</span>{" "}
            <span className="font-mono text-xs text-primary">{me?.tenant_id || "—"}</span>
          </div>
          <div className="text-primary">
            <span className="text-muted">{t("settings.signedInAs")}:</span> {me?.email} ({me?.full_name})
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="max-w-md space-y-4" onSubmit={changePw}>
            <div className="space-y-2">
              <Label htmlFor="c">{t("settings.currentPassword")}</Label>
              <Input id="c" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n">{t("settings.newPassword")}</Label>
              <Input id="n" type="password" value={nw} onChange={(e) => setNw(e.target.value)} required />
            </div>
            <Button type="submit">{t("settings.updatePassword")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
