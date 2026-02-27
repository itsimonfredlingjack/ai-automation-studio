export type GptOssState = "connected" | "model_missing" | "disconnected";

export interface GptOssStatus {
  state: GptOssState;
  model: string;
  base_url: string;
  latency_ms?: number;
  error?: string;
  available_models?: string[];
}

export interface AiUsageEntry {
  node_id: string;
  provider: string;
  model: string;
  tool_mode: boolean;
  is_gpt_oss: boolean;
  source: "executed" | "configured";
}

export interface ExecutionAiUsageSummary {
  entries: AiUsageEntry[];
  gpt_oss_count: number;
  non_gpt_oss_count: number;
}
