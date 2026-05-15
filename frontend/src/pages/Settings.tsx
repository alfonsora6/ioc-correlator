import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export function SettingsPage() {
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
      toast.success("Password updated");
      setCur("");
      setNw("");
    } catch {
      toast.error("Password update failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-400">Tenant isolation and account security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-slate-400">Tenant ID:</span>{" "}
            <span className="font-mono text-xs">{me?.tenant_id || "—"}</span>
          </div>
          <div>
            <span className="text-slate-400">Signed in as:</span> {me?.email} ({me?.full_name})
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="max-w-md space-y-4" onSubmit={changePw}>
            <div className="space-y-2">
              <Label htmlFor="c">Current password</Label>
              <Input id="c" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n">New password</Label>
              <Input id="n" type="password" value={nw} onChange={(e) => setNw(e.target.value)} required />
            </div>
            <Button type="submit">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
