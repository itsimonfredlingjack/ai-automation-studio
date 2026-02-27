import type { AiUsageEntry, ExecutionAiUsageSummary } from "@/types/aiSystem";

interface ExecutionStepLike {
  node_id: string;
  node_type: string;
}

interface FlowNodeLike {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}

const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4o-mini";

function normalizeProvider(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return DEFAULT_PROVIDER;
  }
  return value.trim();
}

function normalizeModel(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return DEFAULT_MODEL;
  }
  return value.trim();
}

function normalizeToolMode(value: unknown): boolean {
  return value === true;
}

export function isGptOssModel(model: string): boolean {
  return model.toLowerCase().includes("gpt-oss");
}

function buildConfiguredAiEntries(nodes: FlowNodeLike[]): AiUsageEntry[] {
  return nodes
    .filter((node) => node.type === "ai_agent")
    .map((node) => {
      const provider = normalizeProvider(node.data?.provider);
      const model = normalizeModel(node.data?.model);
      return {
        node_id: node.id,
        provider,
        model,
        tool_mode: normalizeToolMode(node.data?.tool_mode),
        is_gpt_oss: isGptOssModel(model),
        source: "configured",
      } satisfies AiUsageEntry;
    });
}

export function countNonGptOssConfigured(nodes: FlowNodeLike[]): number {
  return buildConfiguredAiEntries(nodes).filter((entry) => !entry.is_gpt_oss).length;
}

export function deriveAiUsageSummary(params: {
  steps: ExecutionStepLike[];
  nodes: FlowNodeLike[];
  includeConfiguredFallback?: boolean;
}): ExecutionAiUsageSummary {
  const includeConfiguredFallback = params.includeConfiguredFallback ?? true;
  const configuredEntries = buildConfiguredAiEntries(params.nodes);
  const configuredByNodeId = new Map(
    configuredEntries.map((entry) => [entry.node_id, entry])
  );

  const executedAiNodeIds: string[] = [];
  for (const step of params.steps) {
    if (step.node_type !== "ai_agent") {
      continue;
    }
    if (!executedAiNodeIds.includes(step.node_id)) {
      executedAiNodeIds.push(step.node_id);
    }
  }

  let entries: AiUsageEntry[] = [];

  if (executedAiNodeIds.length > 0) {
    entries = executedAiNodeIds.map((nodeId) => {
      const configured = configuredByNodeId.get(nodeId);
      if (configured) {
        return { ...configured, source: "executed" as const };
      }
      const unknownModel = "unknown";
      return {
        node_id: nodeId,
        provider: "unknown",
        model: unknownModel,
        tool_mode: false,
        is_gpt_oss: isGptOssModel(unknownModel),
        source: "executed",
      } satisfies AiUsageEntry;
    });
  } else if (includeConfiguredFallback) {
    entries = configuredEntries;
  }

  return {
    entries,
    gpt_oss_count: entries.filter((entry) => entry.is_gpt_oss).length,
    non_gpt_oss_count: entries.filter((entry) => !entry.is_gpt_oss).length,
  };
}
