import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

function toIsoLocal(dt: string) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toISOString();
}

export function ReportsPage() {
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
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF export failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-400">Export a PDF for a UTC date range.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF export</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from">From (local)</Label>
            <input
              id="from"
              type="datetime-local"
              className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To (local)</Label>
            <input
              id="to"
              type="datetime-local"
              className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="button" onClick={exportPdf} disabled={!from || !to}>
              Export PDF report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
