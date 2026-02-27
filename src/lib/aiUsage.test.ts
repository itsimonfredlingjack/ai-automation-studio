import { describe, expect, it } from "vitest";
import {
  countNonGptOssConfigured,
  deriveAiUsageSummary,
  isGptOssModel,
} from "@/lib/aiUsage";

describe("aiUsage helpers", () => {
  it("detects gpt-oss model names", () => {
    expect(isGptOssModel("gpt-oss:20b")).toBe(true);
    expect(isGptOssModel("GPT-OSS:20B:Q4")).toBe(true);
    expect(isGptOssModel("llama3.1")).toBe(false);
  });

  it("derives executed AI usage entries from steps", () => {
    const summary = deriveAiUsageSummary({
      steps: [{ node_id: "ai-1", node_type: "ai_agent" }],
      nodes: [
        {
          id: "ai-1",
          type: "ai_agent",
          data: { provider: "ollama", model: "gpt-oss:20b", tool_mode: true },
        },
      ],
    });

    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0]).toMatchObject({
      node_id: "ai-1",
      provider: "ollama",
      model: "gpt-oss:20b",
      tool_mode: true,
      is_gpt_oss: true,
      source: "executed",
    });
    expect(summary.gpt_oss_count).toBe(1);
    expect(summary.non_gpt_oss_count).toBe(0);
  });

  it("falls back to configured AI nodes when no executed AI steps", () => {
    const summary = deriveAiUsageSummary({
      steps: [],
      nodes: [
        {
          id: "ai-1",
          type: "ai_agent",
          data: { provider: "openai", model: "gpt-4o-mini" },
        },
        {
          id: "ai-2",
          type: "ai_agent",
          data: { provider: "ollama", model: "gpt-oss:20b" },
        },
      ],
    });

    expect(summary.entries).toHaveLength(2);
    expect(summary.gpt_oss_count).toBe(1);
    expect(summary.non_gpt_oss_count).toBe(1);
    expect(summary.entries.every((entry) => entry.source === "configured")).toBe(
      true
    );
  });

  it("counts non-gpt-oss configured ai nodes", () => {
    const count = countNonGptOssConfigured([
      {
        id: "ai-1",
        type: "ai_agent",
        data: { model: "gpt-oss:20b" },
      },
      {
        id: "ai-2",
        type: "ai_agent",
        data: { model: "claude-sonnet-4-20250514" },
      },
      {
        id: "text-1",
        type: "text_input",
        data: {},
      },
    ]);
    expect(count).toBe(1);
  });
});
