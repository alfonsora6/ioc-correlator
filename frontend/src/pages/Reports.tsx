import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
<<<<<<< HEAD
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
=======
import { api } from "@/lib/api";
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca

function toIsoLocal(dt: string) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toISOString();
}

<<<<<<< HEAD
const dateInputClass = cn(
  "flex h-10 w-full rounded-lg border border-subtle px-3 py-2 text-sm text-primary shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
  "bg-[rgb(var(--input-bg))]",
);

export function ReportsPage() {
  const { t } = useI18n();
=======
export function ReportsPage() {
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
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
<<<<<<< HEAD
      toast.success(t("reports.downloaded"));
    } catch {
      toast.error(t("reports.exportFailed"));
=======
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF export failed");
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
    }
  }

  return (
    <div className="space-y-6">
      <div>
<<<<<<< HEAD
        <h1 className="page-title">{t("reports.title")}</h1>
        <p className="page-subtitle">{t("reports.subtitle")}</p>
=======
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-400">Export a PDF for a UTC date range.</p>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
      </div>

      <Card>
        <CardHeader>
<<<<<<< HEAD
          <CardTitle>{t("reports.pdfExport")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from">{t("reports.from")}</Label>
            <input
              id="from"
              type="datetime-local"
              className={dateInputClass}
=======
          <CardTitle>PDF export</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from">From (local)</Label>
            <input
              id="from"
              type="datetime-local"
              className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
<<<<<<< HEAD
            <Label htmlFor="to">{t("reports.to")}</Label>
            <input
              id="to"
              type="datetime-local"
              className={dateInputClass}
=======
            <Label htmlFor="to">To (local)</Label>
            <input
              id="to"
              type="datetime-local"
              className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="button" onClick={exportPdf} disabled={!from || !to}>
<<<<<<< HEAD
              {t("reports.exportPdf")}
=======
              Export PDF report
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
