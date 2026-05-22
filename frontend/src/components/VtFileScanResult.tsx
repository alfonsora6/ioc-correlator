import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import type { VtFileScanResult } from "@/lib/vtFileScan";
import { severityClass } from "@/lib/severity";

type Props = {
  result: VtFileScanResult;
};

function engineCategoryClass(category: string) {
  if (category === "malicious") return "sev-critical";
  if (category === "suspicious") return "sev-medium";
  if (category === "harmless") return "sev-low";
  return "badge-missing";
}

export function VtFileScanResultView({ result }: Props) {
  const { t } = useI18n();

  function sevLabel(sev: string) {
    const key = `dashboard.severity.${sev}` as TranslationKey;
    const translated = t(key);
    return translated !== key ? translated : sev;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>{t("fileScan.aggregateScore")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-5xl font-bold text-primary">{result.score ?? 0}</div>
          {result.severity && <div className={severityClass(result.severity)}>{sevLabel(result.severity)}</div>}
          <div className="text-xs text-muted">
            {t("fileScan.detections")}: <span className="font-semibold text-primary">{result.detections ?? "—"}</span>
          </div>
          {result.stats && (
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-muted">
              <span>
                {t("fileScan.malicious")}: <strong className="text-primary">{result.stats.malicious}</strong>
              </span>
              <span>
                {t("fileScan.suspicious")}: <strong className="text-primary">{result.stats.suspicious}</strong>
              </span>
              <span>
                {t("fileScan.harmless")}: <strong className="text-primary">{result.stats.harmless}</strong>
              </span>
              <span>
                {t("fileScan.undetected")}: <strong className="text-primary">{result.stats.undetected}</strong>
              </span>
            </div>
          )}
          <div className="text-xs text-muted">
            SHA-256: <span className="break-all font-mono text-primary">{result.sha256}</span>
          </div>
          {result.filename && (
            <div className="text-xs text-muted">
              {t("fileScan.filename")}: <span className="text-primary">{result.filename}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t("fileScan.engineDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-4">{t("fileScan.engine")}</th>
                <th className="py-2 pr-4">{t("fileScan.category")}</th>
                <th className="py-2">{t("fileScan.result")}</th>
              </tr>
            </thead>
            <tbody>
              {result.engines.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-muted">
                    {t("fileScan.noEngines")}
                  </td>
                </tr>
              ) : (
                result.engines.map((row) => (
                  <tr key={row.engine} className="border-t border-subtle">
                    <td className="py-2 pr-4 font-medium text-primary">{row.engine}</td>
                    <td className="py-2 pr-4">
                      <span className={engineCategoryClass(row.category)}>{row.category}</span>
                    </td>
                    <td className="py-2 text-secondary">{row.result ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
