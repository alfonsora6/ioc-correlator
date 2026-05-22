import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function toIsoLocal(dt: string) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toISOString();
}

const dateInputClass = cn(
  "flex h-10 w-full rounded-lg border border-subtle px-3 py-2 text-sm text-primary shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
  "bg-[rgb(var(--input-bg))]",
);

export function ReportsPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function exportPdf() {
    try {
      const fromIso = toIsoLocal(from);
      const toIso = toIsoLocal(to);
      const r = await api.get("/api/v1/reports/pdf", {
        params: { from: fromIso, to: toIso },
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ioc-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("reports.downloaded"));
    } catch {
      toast.error(t("reports.exportFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("reports.title")}</h1>
        <p className="page-subtitle">{t("reports.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.pdfExport")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from">{t("reports.from")}</Label>
            <input
              id="from"
              type="datetime-local"
              className={dateInputClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">{t("reports.to")}</Label>
            <input
              id="to"
              type="datetime-local"
              className={dateInputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="button" onClick={exportPdf} disabled={!from || !to}>
              {t("reports.exportPdf")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
