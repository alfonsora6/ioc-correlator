import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type Source = { provider: string; available: boolean; score?: number | null; severity?: string; error?: string };

export function AnalyzePage() {
  const [ioc, setIoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    severity: string;
    sources: Source[];
    ioc_value: string;
    ioc_type: string;
  } | null>(null);
  const [history, setHistory] = useState<
    { id: string; ioc_value: string; ioc_type: string; score: number; severity: string; created_at: string }[]
  >([]);

  async function refreshHistory() {
    const { data } = await api.get("/api/v1/analyses/history");
    setHistory(data);
  }

  useEffect(() => {
    refreshHistory().catch(() => {});
  }, []);

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/api/v1/analyses", { ioc });
      setResult(data);
      toast.success("Analysis complete");
      await refreshHistory();
    } catch {
      toast.error("Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function sevColor(s: string) {
    if (s === "CRITICAL") return "bg-rose-500/15 text-rose-200";
    if (s === "HIGH") return "bg-orange-500/15 text-orange-200";
    if (s === "MEDIUM") return "bg-amber-500/15 text-amber-200";
    return "bg-emerald-500/15 text-emerald-200";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">IOC analysis</h1>
        <p className="text-sm text-slate-400">Paste an IP, domain, URL, or hash.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analyze</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={onAnalyze}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="ioc">Indicator</Label>
              <Input id="ioc" value={ioc} onChange={(e) => setIoc(e.target.value)} placeholder="8.8.8.8 / example.com / https://… / sha256…" />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Analyzing…" : "Analyze IOC"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Aggregate score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-5xl font-bold">{result.score}</div>
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${sevColor(result.severity)}`}>{result.severity}</div>
              <div className="text-xs text-slate-400">
                Detected type: <span className="font-mono">{result.ioc_type}</span>
              </div>
              <div className="text-xs text-slate-400">
                Normalized: <span className="font-mono">{result.ioc_value}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Per-source</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {result.sources.map((s) => (
                <div key={s.provider} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{s.provider}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${sevColor(s.severity || "LOW")}`}>{s.severity || "LOW"}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {s.available ? <>Score: {s.score ?? "—"}</> : <>Unavailable {s.error ? `(${s.error})` : ""}</>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">IOC</th>
                <th className="py-2">Type</th>
                <th className="py-2">Score</th>
                <th className="py-2">Severity</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-white/10">
                  <td className="py-2 text-xs text-slate-400">{h.created_at}</td>
                  <td className="py-2 font-mono text-xs">{h.ioc_value}</td>
                  <td className="py-2">{h.ioc_type}</td>
                  <td className="py-2">{h.score}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${sevColor(h.severity)}`}>{h.severity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
