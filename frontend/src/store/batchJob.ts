import { create } from "zustand";
import { toast } from "sonner";
import { translate, useLocaleStore } from "@/i18n";
import { api, getWebSocketBaseURL } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export type BatchProgress = {
  processed: number;
  total: number;
  status: string;
};

type BatchJobState = {
  jobId: string | null;
  filename: string | null;
  progress: BatchProgress | null;
  uploading: boolean;
  startUpload: (file: File) => Promise<void>;
  /** Reattach WS (or poll once) if a non-terminal job exists without a live socket. */
  ensureConnected: () => void;
  reset: () => void;
};

let activeWs: WebSocket | null = null;
let activeWsJobId: string | null = null;

function isTerminal(status: string | undefined) {
  return status === "done" || status === "error";
}

function closeWs() {
  if (activeWs) {
    try {
      activeWs.onmessage = null;
      activeWs.onerror = null;
      activeWs.onclose = null;
      activeWs.close();
    } catch {
      /* ignore */
    }
  }
  activeWs = null;
  activeWsJobId = null;
}

function applyProgressMessage(msg: { processed?: number; total?: number; status?: string; error?: string }) {
  if (msg.error) {
    toast.error(msg.error);
    closeWs();
    return;
  }
  const processed = msg.processed ?? 0;
  const total = msg.total ?? 0;
  const status = msg.status ?? "pending";
  useBatchJobStore.setState({
    progress: { processed, total, status },
  });
  if (isTerminal(status)) {
    closeWs();
  }
}

function connectWs(jobId: string) {
  if (activeWs && activeWsJobId === jobId && activeWs.readyState <= WebSocket.OPEN) {
    return;
  }
  closeWs();

  const token = useAuthStore.getState().accessToken;
  const ws = new WebSocket(
    `${getWebSocketBaseURL()}/api/v1/batch/ws/${jobId}?token=${encodeURIComponent(token || "")}`,
  );
  activeWs = ws;
  activeWsJobId = jobId;

  ws.onmessage = (ev) => {
    try {
      applyProgressMessage(JSON.parse(ev.data));
    } catch {
      /* ignore malformed */
    }
  };
  ws.onerror = () => {
    const locale = useLocaleStore.getState().locale;
    toast.error(translate(locale, "batch.wsError"));
  };
  ws.onclose = () => {
    if (activeWs === ws) {
      activeWs = null;
      activeWsJobId = null;
    }
  };
}

async function refreshJobFromApi(jobId: string) {
  try {
    const { data } = await api.get<{
      id: string;
      filename: string;
      total_iocs: number;
      processed: number;
      status: string;
    }>(`/api/v1/batch/${jobId}`);
    useBatchJobStore.setState({
      jobId: data.id,
      filename: data.filename,
      progress: {
        processed: data.processed,
        total: data.total_iocs,
        status: data.status,
      },
    });
    if (!isTerminal(data.status)) {
      connectWs(data.id);
    } else {
      closeWs();
    }
  } catch {
    /* keep existing store state */
  }
}

export const useBatchJobStore = create<BatchJobState>((set, get) => ({
  jobId: null,
  filename: null,
  progress: null,
  uploading: false,

  startUpload: async (file: File) => {
    if (get().uploading) return;
    set({ uploading: true });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ job_id: string; total_iocs: number }>("/api/v1/batch/upload", fd);
      closeWs();
      set({
        jobId: data.job_id,
        filename: file.name,
        progress: { processed: 0, total: data.total_iocs, status: "pending" },
        uploading: false,
      });
      connectWs(data.job_id);
    } catch (err) {
      set({ uploading: false });
      throw err;
    }
  },

  ensureConnected: () => {
    const { jobId, progress } = get();
    if (!jobId || !progress) return;
    if (isTerminal(progress.status)) return;

    const live =
      activeWs &&
      activeWsJobId === jobId &&
      (activeWs.readyState === WebSocket.CONNECTING || activeWs.readyState === WebSocket.OPEN);

    if (live) return;

    // Snapshot from API then (re)open WS for live updates.
    void refreshJobFromApi(jobId);
  },

  reset: () => {
    closeWs();
    set({ jobId: null, filename: null, progress: null, uploading: false });
  },
}));
