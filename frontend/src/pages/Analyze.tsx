import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VtFileScanResultView } from "@/components/VtFileScanResult";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { api } from "@/lib/api";
import { severityClass } from "@/lib/severity";
import { formatScanError, scanVtFile, type VtFileScanResult } from "@/lib/vtFileScan";

type Source = { provider: string; available: boolean; score?: number | null; severity?: string; error?: string };

export function AnalyzePage() {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ioc, setIoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    severity: string;
    sources: Source[];
    ioc_value: string;
    ioc_type: string;
  } | null>(null);

  const [fileScanning, setFileScanning] = useState(false);
  const [filePhase, setFilePhase] = useState("");
  const [fileResult, setFileResult] = useState<VtFileScanResult | null>(null);

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
      toast.success(t("analyze.complete"));
      await refreshHistory();
    } catch {
      toast.error(t("analyze.failed"));
    } finally {
      setLoading(false);
    }
  }

  function phaseLabel(phase: string, detail?: string) {
    if (phase === "hashing") return t("fileScan.phaseHashing");
    if (phase === "lookup") return detail ? `${t("fileScan.phaseLookup")} ${detail.slice(0, 12)}…` : t("fileScan.phaseLookup");
    if (phase === "uploading") return t("fileScan.phaseUploading");
    if (phase === "polling") return detail ? `${t("fileScan.phasePolling")} ${detail}` : t("fileScan.phasePolling");
    return phase;
  }

  async function onScanFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setFileScanning(true);
    setFileResult(null);
    setFilePhase(t("fileScan.phaseHashing"));
    try {
      const { result: scanResult, cached } = await scanVtFile(file, (phase, detail) => {
        setFilePhase(phaseLabel(phase, detail));
      });
      setFileResult(scanResult);
      toast.success(cached ? t("fileScan.knownFile") : t("fileScan.complete"));
    } catch (err) {
      console.error("VT file scan failed:", err);
      toast.error(formatScanError(err, t("fileScan.failed")));
    } finally {
      setFileScanning(false);
      setFilePhase("");
    }
  }

  function sevLabel(sev: string) {
    const key = `dashboard.severity.${sev}` as TranslationKey;
    const translated = t(key);
    return translated !== key ? translated : sev;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("analyze.title")}</h1>
        <p className="page-subtitle">{t("analyze.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("analyze.analyze")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={onAnalyze}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="ioc">{t("analyze.indicator")}</Label>
              <Input id="ioc" value={ioc} onChange={(e) => setIoc(e.target.value)} placeholder={t("analyze.placeholder")} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? t("analyze.analyzing") : t("analyze.analyzeIoc")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("fileScan.title")}</CardTitle>
          <p className="text-sm text-secondary">{t("fileScan.subtitle")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="text-sm text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onScanFile} disabled={fileScanning}>
              {fileScanning ? t("fileScan.scanning") : t("fileScan.scanFile")}
            </Button>
            {filePhase && <span className="text-sm text-muted">{filePhase}</span>}
          </div>
        </CardContent>
      </Card>

      {fileResult && <VtFileScanResultView result={fileResult} />}

      {result && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
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
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
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
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
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
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-subtle">
                  <td className="py-2 pr-4 text-xs text-muted">{h.created_at}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-primary">{h.ioc_value}</td>
                  <td className="py-2 pr-4 text-primary">{h.ioc_type}</td>
                  <td className="py-2 pr-4 text-primary">{h.score}</td>
                  <td className="py-2">
                    <span className={severityClass(h.severity)}>{sevLabel(h.severity)}</span>
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
