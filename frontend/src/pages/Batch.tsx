import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useBatchJobStore } from "@/store/batchJob";
import { cn } from "@/lib/utils";

const ALLOWED_EXTENSIONS = new Set([".txt", ".csv", ".log"]);

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function isAllowedBatchFile(file: File): boolean {
  return ALLOWED_EXTENSIONS.has(fileExtension(file.name));
}

export function BatchPage() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const jobId = useBatchJobStore((s) => s.jobId);
  const progress = useBatchJobStore((s) => s.progress);
  const uploading = useBatchJobStore((s) => s.uploading);
  const filename = useBatchJobStore((s) => s.filename);
  const startUpload = useBatchJobStore((s) => s.startUpload);
  const ensureConnected = useBatchJobStore((s) => s.ensureConnected);

  useEffect(() => {
    ensureConnected();
  }, [ensureConnected]);

  const assignFileToInput = useCallback(
    (file: File) => {
      if (!isAllowedBatchFile(file)) {
        toast.error(t("batch.invalidFileType"));
        return;
      }
      const input = inputRef.current;
      if (!input) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    },
    [t],
  );

  async function onPick() {
    const f = inputRef.current?.files?.[0];
    if (!f) return;
    if (!isAllowedBatchFile(f)) {
      toast.error(t("batch.invalidFileType"));
      return;
    }
    try {
      await startUpload(f);
      toast.success(t("batch.queued"));
    } catch {
      toast.error(t("batch.uploadFailed"));
    }
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragOver(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    assignFileToInput(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("batch.title")}</h1>
        <p className="page-subtitle">{t("batch.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("batch.upload")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
              "flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition-colors md:flex-row md:items-center",
              dragOver
                ? "border-brand-500 bg-brand-500/10"
                : "border-[var(--border)] bg-transparent",
            )}
          >
            <p className="text-sm text-secondary md:mr-auto">{t("batch.dropHint")}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.csv,.log,text/plain"
              className="text-sm text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
            />
            <Button onClick={onPick} disabled={uploading}>
              {uploading ? t("batch.uploading") : t("batch.startBatch")}
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
                    toast.error(t("batch.exportFailed"));
                  }
                }}
              >
                {t("batch.downloadCsv")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>{t("batch.progress")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-secondary">
              {t("batch.status")}: <span className="font-semibold text-primary">{progress.status}</span>
              {filename && (
                <span className="ml-2 font-mono text-xs text-muted truncate" title={filename}>
                  ({filename})
                </span>
              )}
            </div>
            <div className="progress-track">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${progress.total ? Math.round((100 * progress.processed) / progress.total) : 0}%` }}
              />
            </div>
            <div className="text-xs text-muted">
              {progress.processed} / {progress.total}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
