import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
<<<<<<< HEAD
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { api } from "@/lib/api";
import { severityClass } from "@/lib/severity";
=======
import { api } from "@/lib/api";
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca

type Source = { provider: string; available: boolean; score?: number | null; severity?: string; error?: string };

export function AnalyzePage() {
<<<<<<< HEAD
  const { t } = useI18n();
=======
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
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
<<<<<<< HEAD
      toast.success(t("analyze.complete"));
      await refreshHistory();
    } catch {
      toast.error(t("analyze.failed"));
=======
      toast.success("Analysis complete");
      await refreshHistory();
    } catch {
      toast.error("Analysis failed");
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
    } finally {
      setLoading(false);
    }
  }

<<<<<<< HEAD
  function sevLabel(sev: string) {
    const key = `dashboard.severity.${sev}` as TranslationKey;
    const translated = t(key);
    return translated !== key ? translated : sev;
=======
  function sevColor(s: string) {
    if (s === "CRITICAL") return "bg-rose-500/15 text-rose-200";
    if (s === "HIGH") return "bg-orange-500/15 text-orange-200";
    if (s === "MEDIUM") return "bg-amber-500/15 text-amber-200";
    return "bg-emerald-500/15 text-emerald-200";
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
  }

  return (
    <div className="space-y-6">
      <div>
<<<<<<< HEAD
        <h1 className="page-title">{t("analyze.title")}</h1>
        <p className="page-subtitle">{t("analyze.subtitle")}</p>
=======
        <h1 className="text-2xl font-semibold">IOC analysis</h1>
        <p className="text-sm text-slate-400">Paste an IP, domain, URL, or hash.</p>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
      </div>

      <Card>
        <CardHeader>
<<<<<<< HEAD
          <CardTitle>{t("analyze.analyze")}</CardTitle>
=======
          <CardTitle>Analyze</CardTitle>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={onAnalyze}>
            <div className="flex-1 space-y-2">
<<<<<<< HEAD
              <Label htmlFor="ioc">{t("analyze.indicator")}</Label>
              <Input id="ioc" value={ioc} onChange={(e) => setIoc(e.target.value)} placeholder={t("analyze.placeholder")} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? t("analyze.analyzing") : t("analyze.analyzeIoc")}
=======
              <Label htmlFor="ioc">Indicator</Label>
              <Input id="ioc" value={ioc} onChange={(e) => setIoc(e.target.value)} placeholder="8.8.8.8 / example.com / https://… / sha256…" />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Analyzing…" : "Analyze IOC"}
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
<<<<<<< HEAD
              <CardTitle>{t("analyze.aggregateScore")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-5xl font-bold text-primary">{result.score}</div>
              <div className={severityClass(result.severity)}>{sevLabel(result.severity)}</div>
              <div className="text-xs text-muted">
                {t("analyze.detectedType")}: <span className="font-mono text-primary">{result.ioc_type}</span>
              </div>
              <div className="text-xs text-muted">
                {t("analyze.normalized")}: <span className="font-mono text-primary">{result.ioc_value}</span>
=======
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
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
<<<<<<< HEAD
              <CardTitle>{t("analyze.perSource")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {result.sources.map((s) => (
                <div key={s.provider} className="surface-row p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold capitalize text-primary">{s.provider}</div>
                    <span className={severityClass(s.severity || "LOW")}>{sevLabel(s.severity || "LOW")}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    {s.available ? (
                      <>
                        {t("analyze.score")}: {s.score ?? "—"}
                      </>
                    ) : (
                      <>
                        {t("analyze.unavailable")} {s.error ? `(${s.error})` : ""}
                      </>
                    )}
=======
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
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
<<<<<<< HEAD
          <CardTitle>{t("analyze.recentHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-4">{t("analyze.time")}</th>
                <th className="py-2 pr-4">{t("analyze.ioc")}</th>
                <th className="py-2 pr-4">{t("analyze.type")}</th>
                <th className="py-2 pr-4">{t("analyze.score")}</th>
                <th className="py-2">{t("analyze.severity")}</th>
=======
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
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
<<<<<<< HEAD
                <tr key={h.id} className="border-t border-subtle">
                  <td className="py-2 pr-4 text-xs text-muted">{h.created_at}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-primary">{h.ioc_value}</td>
                  <td className="py-2 pr-4 text-primary">{h.ioc_type}</td>
                  <td className="py-2 pr-4 text-primary">{h.score}</td>
                  <td className="py-2">
                    <span className={severityClass(h.severity)}>{sevLabel(h.severity)}</span>
=======
                <tr key={h.id} className="border-t border-white/10">
                  <td className="py-2 text-xs text-slate-400">{h.created_at}</td>
                  <td className="py-2 font-mono text-xs">{h.ioc_value}</td>
                  <td className="py-2">{h.ioc_type}</td>
                  <td className="py-2">{h.score}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${sevColor(h.severity)}`}>{h.severity}</span>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
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
