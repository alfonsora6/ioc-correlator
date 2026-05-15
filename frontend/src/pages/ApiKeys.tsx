import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type Row = { provider: string; status: string; has_key: boolean };

export function ApiKeysPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  async function refresh() {
    const { data } = await api.get<Row[]>("/api/v1/api-keys");
    setRows(data);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function save(provider: string) {
    const v = values[provider]?.trim();
    if (!v) return toast.error("Paste a key first");
    try {
      await api.post(`/api/v1/api-keys/${provider}`, { api_key: v });
      toast.success(`${provider} saved`);
      await refresh();
    } catch {
      toast.error("Save failed");
    }
  }

  async function validate(provider: string) {
    try {
      const { data } = await api.post<{ status: string; error?: string | null }>(`/api/v1/api-keys/${provider}/validate`);
      toast.message(`Validate: ${data.status}`, { description: data.error || "" });
      await refresh();
    } catch {
      toast.error("Validate failed");
    }
  }

  async function remove(provider: string) {
    try {
      await api.delete(`/api/v1/api-keys/${provider}`);
      toast.success(`${provider} removed`);
      await refresh();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function vtOAuth() {
    try {
      const { data } = await api.get<{ authorization_url: string; state: string }>("/api/v1/auth/virustotal/authorize");
      window.open(data.authorization_url, "vt_oauth", "width=600,height=720");
      toast.message("Complete OAuth in the popup", { description: "Then validate the VirusTotal key." });
    } catch (e: unknown) {
      toast.error("OAuth not available (check VT_CLIENT_ID on server)");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API keys</h1>
        <p className="text-sm text-slate-400">Keys are encrypted at rest. Use validate after saving.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.provider}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base capitalize">{r.provider}</CardTitle>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-200">{r.status}</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  placeholder={r.has_key ? "••••••••" : "Paste key"}
                  value={values[r.provider] || ""}
                  onChange={(e) => setValues((s) => ({ ...s, [r.provider]: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => save(r.provider)}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => validate(r.provider)} disabled={!r.has_key && !values[r.provider]}>
                  Validate
                </Button>
                <Button type="button" variant="outline" onClick={() => remove(r.provider)} disabled={!r.has_key}>
                  Delete
                </Button>
                {r.provider === "virustotal" && (
                  <Button type="button" variant="outline" onClick={vtOAuth}>
                    Connect with OAuth
                  </Button>
                )}
              </div>
              {r.provider === "abuseipdb" && (
                <a className="text-xs text-brand-400 hover:underline" href="https://www.abuseipdb.com/pricing" target="_blank" rel="noreferrer">
                  AbuseIPDB registration
                </a>
              )}
              {r.provider === "shodan" && (
                <div className="flex flex-col gap-1 text-xs">
                  <a className="text-brand-400 hover:underline" href="https://account.shodan.io/register" target="_blank" rel="noreferrer">
                    Shodan registration
                  </a>
                  <a className="text-brand-400 hover:underline" href="https://account.shodan.io/" target="_blank" rel="noreferrer">
                    Open Shodan account
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
