import { create } from "zustand";
import { checkGptOssStatus } from "@/lib/tauri";
import { trackEvent } from "@/lib/analytics";
import type { GptOssStatus } from "@/types/aiSystem";

const DEFAULT_BASE_URL = "http://192.168.86.32:11434";
const DEFAULT_MODEL = "gpt-oss:20b";
const DEFAULT_POLL_INTERVAL_MS = 15_000;

let pollTimer: number | null = null;
let indicatorTracked = false;

interface AiSystemStore {
  status: GptOssStatus | null;
  loading: boolean;
  lastCheckedAt: number | null;
  pollIntervalMs: number;
  refreshGptOssStatus: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

function fallbackDisconnectedStatus(error: unknown): GptOssStatus {
  const errorText = error instanceof Error ? error.message : String(error);
  const normalizedError =
    errorText.includes("invoke") && errorText.includes("undefined")
      ? "Tauri bridge unavailable in browser mode"
      : errorText;
  return {
    state: "disconnected",
    model: DEFAULT_MODEL,
    base_url: DEFAULT_BASE_URL,
    error: normalizedError,
    latency_ms: undefined,
    available_models: undefined,
  };
}

export const useAiSystemStore = create<AiSystemStore>((set, get) => ({
  status: null,
  loading: false,
  lastCheckedAt: null,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,

  refreshGptOssStatus: async () => {
    set({ loading: true });
    const previousState = get().status?.state;
    try {
      const status = await checkGptOssStatus({
        base_url: DEFAULT_BASE_URL,
        model: DEFAULT_MODEL,
      });
      const lastCheckedAt = Date.now();
      set({ status, loading: false, lastCheckedAt });

      if (!indicatorTracked) {
        indicatorTracked = true;
        void trackEvent("gpt_oss_indicator_rendered", {
          state: status.state,
          model: status.model,
          base_url: status.base_url,
        });
      }

      if (previousState !== status.state) {
        void trackEvent("gpt_oss_health_state_changed", {
          state: status.state,
          model: status.model,
          base_url: status.base_url,
        });
      }
    } catch (error) {
      const status = fallbackDisconnectedStatus(error);
      set({
        status,
        loading: false,
        lastCheckedAt: Date.now(),
      });

      if (!indicatorTracked) {
        indicatorTracked = true;
        void trackEvent("gpt_oss_indicator_rendered", {
          state: status.state,
          model: status.model,
          base_url: status.base_url,
        });
      }

      if (previousState !== "disconnected") {
        void trackEvent("gpt_oss_health_state_changed", {
          state: status.state,
          model: status.model,
          base_url: status.base_url,
        });
      }
    }
  },

  startPolling: () => {
    void get().refreshGptOssStatus();
    if (pollTimer !== null) {
      return;
    }
    pollTimer = window.setInterval(() => {
      void get().refreshGptOssStatus();
    }, get().pollIntervalMs);
  },

  stopPolling: () => {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  },
}));
