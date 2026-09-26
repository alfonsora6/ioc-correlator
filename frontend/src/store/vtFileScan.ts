import { create } from "zustand";
import {
  pollVtAnalysis,
  scanVtFile,
  VT_MAX_POLL_ATTEMPTS,
  type VtFileScanResult,
} from "@/lib/vtFileScan";

export type VtScanPhase = "" | "hashing" | "lookup" | "uploading" | "polling";

export type EnsurePollingOutcome = "noop" | "completed" | "failed";

type VtFileScanState = {
  scanning: boolean;
  phase: VtScanPhase;
  phaseDetail: string;
  filename: string | null;
  sha256: string | null;
  analysisId: string | null;
  result: VtFileScanResult | null;
  lastCached: boolean | null;
  lastError: unknown | null;
  /** True while an async scan/poll owned by this module is running. */
  _inflight: boolean;
  startScan: (file: File) => Promise<{ result: VtFileScanResult; cached: boolean }>;
  /** If a job is mid-poll but the previous promise was lost, resume polling. */
  ensurePolling: () => Promise<EnsurePollingOutcome>;
  clearResult: () => void;
  reset: () => void;
};

const initialUi = {
  scanning: false,
  phase: "" as VtScanPhase,
  phaseDetail: "",
  filename: null as string | null,
  sha256: null as string | null,
  analysisId: null as string | null,
  result: null as VtFileScanResult | null,
  lastCached: null as boolean | null,
  lastError: null as unknown | null,
  _inflight: false,
};

function applyProgress(phase: VtScanPhase, detail?: string) {
  const patch: Partial<VtFileScanState> = {
    phase,
    phaseDetail: detail ?? "",
  };
  if (phase === "lookup" && detail) {
    patch.sha256 = detail;
  }
  // First polling callback passes raw analysis_id; later ones pass "status (n/m)".
  if (phase === "polling" && detail && !detail.includes("(") && !detail.includes(" ")) {
    patch.analysisId = detail;
  }
  useVtFileScanStore.setState(patch);
}

export const useVtFileScanStore = create<VtFileScanState>((set, get) => ({
  ...initialUi,

  clearResult: () => set({ result: null, lastCached: null, lastError: null }),

  reset: () => set({ ...initialUi }),

  startScan: async (file: File) => {
    if (get().scanning || get()._inflight) {
      throw new Error("scan_already_running");
    }

    set({
      scanning: true,
      _inflight: true,
      result: null,
      lastCached: null,
      lastError: null,
      filename: file.name,
      sha256: null,
      analysisId: null,
      phase: "hashing",
      phaseDetail: "",
    });

    try {
      const { result, cached } = await scanVtFile(file, (phase, detail) => {
        if (phase === "hashing" || phase === "lookup" || phase === "uploading" || phase === "polling") {
          applyProgress(phase, detail);
        }
      });
      set({
        result,
        lastCached: cached,
        scanning: false,
        _inflight: false,
        phase: "",
        phaseDetail: "",
        sha256: result.sha256 || get().sha256,
        analysisId: result.analysis_id ?? get().analysisId,
      });
      return { result, cached };
    } catch (err) {
      set({
        scanning: false,
        _inflight: false,
        phase: "",
        phaseDetail: "",
      });
      throw err;
    }
  },

  ensurePolling: async () => {
    const state = get();
    if (!state.scanning || !state.analysisId || state._inflight) return "noop";

    set({ _inflight: true, phase: "polling", lastError: null });
    try {
      const result = await pollVtAnalysis(
        state.analysisId,
        { sha256: state.sha256 ?? undefined, filename: state.filename ?? undefined },
        (status, attempt) => {
          set({
            phase: "polling",
            phaseDetail: `${status} (${attempt}/${VT_MAX_POLL_ATTEMPTS})`,
          });
        },
      );
      set({
        result: {
          ...result,
          filename: state.filename ?? result.filename,
          sha256: result.sha256 || state.sha256 || "",
        },
        lastCached: false,
        scanning: false,
        _inflight: false,
        phase: "",
        phaseDetail: "",
      });
      return "completed";
    } catch (err) {
      set({
        scanning: false,
        _inflight: false,
        phase: "",
        phaseDetail: "",
        lastError: err,
      });
      return "failed";
    }
  },
}));
