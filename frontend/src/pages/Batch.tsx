import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function BatchPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number; status: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const wsBase = useMemo(() => (import.meta.env.VITE_API_URL || `http://${location.hostname}:8000`).replace(/^http/, "ws"), []);

  async function onPick() {
    const f = inputRef.current?.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post<{ job_id: string; total_iocs: number }>("/api/v1/batch/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setJobId(data.job_id);
      setProgress({ processed: 0, total: data.total_iocs, status: "pending" });
      toast.success("Batch queued");
      connectWs(data.job_id);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function connectWs(id: string) {
    const token = useAuthStore.getState().accessToken;
    const ws = new WebSocket(`${wsBase}/api/v1/batch/ws/${id}?token=${encodeURIComponent(token || "")}`);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.error) {
        toast.error(msg.error);
        ws.close();
        return;
      }
      setProgress({ processed: msg.processed, total: msg.total, status: msg.status });
      if (msg.status === "done" || msg.status === "error") ws.close();
    };
    ws.onerror = () => toast.error("WebSocket error");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Batch analysis</h1>
        <p className="text-sm text-slate-400">Upload .txt / .csv / .log files (max 2MB).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <input ref={inputRef} type="file" accept=".txt,.csv,.log,text/plain" className="text-sm" />
          <Button onClick={onPick} disabled={uploading}>
            {uploading ? "Uploading…" : "Start batch"}
          </Button>
          {jobId && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const r = await api.get(`/api/v1/batch/${jobId}/export.csv`, { responseType: "blob" });
                  const url = URL.createObjectURL(r.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `batch-${jobId}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Export failed");
                }
              }}
            >
              Download CSV
            </Button>
          )}
        </CardContent>
      </Card>

      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-slate-300">
              Status: <span className="font-semibold">{progress.status}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${progress.total ? Math.round((100 * progress.processed) / progress.total) : 0}%` }}
              />
            </div>
            <div className="text-xs text-slate-400">
              {progress.processed} / {progress.total}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
