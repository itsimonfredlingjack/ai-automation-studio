import type { GptOssStatus } from "@/types/aiSystem";

export type GptOssTone = "success" | "warning" | "danger";

export interface GptOssDisplayState {
  tone: GptOssTone;
  headline: string;
  detail: string;
}

export function mapGptOssStatusToDisplay(
  status: GptOssStatus | null
): GptOssDisplayState {
  if (!status) {
    return {
      tone: "warning",
      headline: "GPT-OSS status unknown",
      detail: "Checking model availability...",
    };
  }

  if (status.state === "connected") {
    return {
      tone: "success",
      headline: "GPT-OSS System Active",
      detail: `${status.model} @ ${status.base_url}`,
    };
  }

  if (status.state === "model_missing") {
    return {
      tone: "warning",
      headline: "GPT-OSS model missing",
      detail: `${status.model} not found on ${status.base_url}`,
    };
  }

  return {
    tone: "danger",
    headline: "GPT-OSS disconnected",
    detail: status.error?.trim() || `Cannot reach ${status.base_url}`,
  };
}

export function formatHealthAge(lastCheckedAt: number | null): string {
  if (!lastCheckedAt) {
    return "never";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - lastCheckedAt) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
