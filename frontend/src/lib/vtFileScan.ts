import { api } from "@/lib/api";
import { sha256Hex } from "@/lib/sha256";

export const VT_MAX_FILE_BYTES = 650 * 1024 * 1024;
export const VT_POLL_INTERVAL_MS = 15_000;
export const VT_MAX_POLL_ATTEMPTS = 20;

export type VtEngineRow = {
  engine: string;
  category: string;
  result: string | null;
  method?: string | null;
};

export type VtFileScanResult = {
  found: boolean;
  sha256: string;
  filename?: string | null;
  analysis_id?: string | null;
  status: string;
  score: number | null;
  severity: string | null;
  detections: string | null;
  stats?: {
    malicious: number;
    suspicious: number;
    undetected: number;
    harmless: number;
    total: number;
  };
  engines: VtEngineRow[];
  provider: string;
};

export type VtScanErrorCode =
  | "rate_limit"
  | "timeout"
  | "file_too_large"
  | "no_vt_api_key"
  | "empty_file"
  | "vt_error"
  | "unknown";

export class VtScanError extends Error {
  code: VtScanErrorCode;
  constructor(code: VtScanErrorCode, message?: string) {
    super(message || code);
    this.code = code;
  }
}

type ApiDetail =
  | string
  | { code?: string; message?: string }
  | Array<{ msg?: string; type?: string }>;

function parseDetail(detail: ApiDetail | undefined): { code: string; message?: string } | null {
  if (!detail) return null;
  if (typeof detail === "string") return { code: detail };
  if (Array.isArray(detail)) {
    const msg = detail.map((d) => d.msg).filter(Boolean).join("; ");
    return { code: "validation_error", message: msg || "Invalid request" };
  }
  if (typeof detail === "object" && detail.code) {
    return { code: detail.code, message: detail.message };
  }
  return null;
}

function mapAxiosError(err: unknown): never {
  const response = (err as { response?: { status?: number; data?: { detail?: ApiDetail } } })?.response;
  const status = response?.status;
  const parsed = parseDetail(response?.data?.detail);
  const code = parsed?.code;
  const message = parsed?.message;

  if (status === 401) throw new VtScanError("unknown", "Sesión expirada. Vuelve a iniciar sesión.");
  if (status === 429 || code === "rate_limit") throw new VtScanError("rate_limit", message);
  if (code === "file_too_large") throw new VtScanError("file_too_large", message);
  if (code === "no_vt_api_key") throw new VtScanError("no_vt_api_key", message);
  if (code === "key_decrypt_failed") throw new VtScanError("unknown", "Error al leer la clave API guardada.");
  if (code === "empty_file") throw new VtScanError("empty_file", message);
  if (code === "vt_error") throw new VtScanError("vt_error", message);
  if (code === "validation_error") throw new VtScanError("vt_error", message);
  if (status === 413) throw new VtScanError("file_too_large", message);
  if (message) throw new VtScanError("unknown", message);
  throw new VtScanError("unknown");
}

export function formatScanError(err: unknown, fallback: string): string {
  if (err instanceof VtScanError) {
    if (err.message && err.message !== err.code) return err.message;
    return fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function lookupVtFile(sha256: string): Promise<VtFileScanResult | null> {
  try {
    const { data } = await api.get<VtFileScanResult & { found: boolean }>(`/api/v1/vt/files/${sha256}`);
    return data.found ? (data as VtFileScanResult) : null;
  } catch (err) {
    mapAxiosError(err);
  }
}

export async function uploadVtFile(file: File): Promise<{ analysis_id: string }> {
  if (file.size > VT_MAX_FILE_BYTES) throw new VtScanError("file_too_large");
  if (file.size === 0) throw new VtScanError("empty_file");
  const fd = new FormData();
  fd.append("file", file);
  try {
    const { data } = await api.post<{ analysis_id: string }>("/api/v1/vt/files", fd, {
      timeout: 600_000,
    });
    return data;
  } catch (err) {
    mapAxiosError(err);
  }
}

export async function pollVtAnalysis(
  analysisId: string,
  ctx: { sha256?: string; filename?: string },
  onProgress?: (status: string, attempt: number) => void,
): Promise<VtFileScanResult> {
  for (let attempt = 1; attempt <= VT_MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const { data } = await api.get<VtFileScanResult & { status: string; found: boolean }>(
        `/api/v1/vt/analyses/${analysisId}`,
        { params: { sha256: ctx.sha256, filename: ctx.filename } },
      );
      onProgress?.(data.status, attempt);
      if (data.status === "completed") {
        if (data.found) {
          return data as VtFileScanResult;
        }
        if (ctx.sha256) {
          const lookup = await lookupVtFile(ctx.sha256);
          if (lookup) {
            return { ...lookup, analysis_id: analysisId, filename: ctx.filename ?? lookup.filename };
          }
        }
        throw new VtScanError("vt_error", "Analysis completed without results");
      }
      if (data.status === "failed") {
        throw new VtScanError("vt_error", "Analysis failed");
      }
    } catch (err) {
      if (err instanceof VtScanError) throw err;
      mapAxiosError(err);
    }
    if (attempt < VT_MAX_POLL_ATTEMPTS) {
      await sleep(VT_POLL_INTERVAL_MS);
    }
  }
  throw new VtScanError("timeout");
}

export async function scanVtFile(
  file: File,
  onProgress?: (phase: string, detail?: string) => void,
): Promise<{ result: VtFileScanResult; cached: boolean }> {
  onProgress?.("hashing");
  const sha256 = await sha256Hex(file);
  onProgress?.("lookup", sha256);

  const existing = await lookupVtFile(sha256);
  if (existing) {
    return {
      result: { ...existing, filename: file.name, sha256 },
      cached: true,
    };
  }

  onProgress?.("uploading");
  const { analysis_id } = await uploadVtFile(file);

  onProgress?.("polling", analysis_id);
  const result = await pollVtAnalysis(analysis_id, { sha256, filename: file.name }, (status, attempt) => {
    onProgress?.("polling", `${status} (${attempt}/${VT_MAX_POLL_ATTEMPTS})`);
  });

  return {
    result: { ...result, filename: file.name, sha256: result.sha256 || sha256 },
    cached: false,
  };
}
