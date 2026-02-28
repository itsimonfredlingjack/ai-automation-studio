import { describe, expect, it } from "vitest";
import {
  buildExistingWorkflowPreview,
  buildStarterAutomationPreview,
  summarizeWorkflowForPreview,
} from "@/lib/automationPreview";
import type { Workflow } from "@/types/workflow";

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: overrides.id ?? "workflow-1",
    name: overrides.name ?? "Workflow",
    created_at: overrides.created_at ?? "2026-02-27T12:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-02-27T12:00:00.000Z",
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    description: overrides.description,
  };
}

describe("automationPreview", () => {
  it("builds starter preview with processed outputs", () => {
    const preview = buildStarterAutomationPreview({
      watchPath: "/Users/coffeedev/Documents/inbox",
      recursive: true,
      fileGlob: "*.pdf",
      workflowName: "GPT-OSS Summary Starter",
      instruction:
        "Summarize the trigger file into bullets and highlight action items.",
      recipeSummary: "Summarizes each matching document into concise bullets.",
    });

    expect(preview.outputs.map((output) => output.path)).toEqual([
      "_processed/<basename>.summary.md",
      "_processed/<basename>.meta.json",
      "Recent Automations",
    ]);
    expect(preview.originalFile).toBe("Original file is not changed.");
    expect(preview.gptOssCount).toBe(1);
    expect(preview.nonGptOssCount).toBe(0);
  });

  it("summarizes doc-pipeline workflows", () => {
    const workflow = makeWorkflow({
      nodes: [
        {
          id: "ai-1",
          node_type: "ai_agent",
          position: { x: 0, y: 0 },
          data: {
            provider: "ollama",
            model: "gpt-oss:20b",
            tool_mode: true,
            tool_profile: "doc_pipeline_v1",
          },
        },
      ],
    });

    const summary = summarizeWorkflowForPreview(workflow);
    expect(summary.usesDocPipeline).toBe(true);
    expect(summary.gptOssModelsCount).toBe(1);
    expect(summary.nonGptOssModelsCount).toBe(0);
  });

  it("builds existing workflow preview for mixed-model workflows", () => {
    const workflow = makeWorkflow({
      nodes: [
        {
          id: "ai-1",
          node_type: "ai_agent",
          position: { x: 0, y: 0 },
          data: {
            provider: "ollama",
            model: "gpt-oss:20b",
            tool_mode: true,
            tool_profile: "doc_pipeline_v1",
          },
        },
        {
          id: "ai-2",
          node_type: "ai_agent",
          position: { x: 10, y: 0 },
          data: {
            provider: "openai",
            model: "gpt-4o-mini",
          },
        },
      ],
    });

    const preview = buildExistingWorkflowPreview({
      workflow,
      watchPath: "/Users/coffeedev/Documents/inbox",
      recursive: false,
      fileGlob: "*.*",
    });

    expect(preview.summary).toContain("Processes each matching file");
    expect(preview.originalFile).toBe("Original file is not changed.");
    expect(preview.nonGptOssCount).toBe(1);
    expect(preview.warning).toContain("Mixed model");
  });

  it("falls back for workflows without ai nodes", () => {
    const workflow = makeWorkflow({
      nodes: [
        {
          id: "text-1",
          node_type: "text_input",
          position: { x: 0, y: 0 },
          data: { text: "hello" },
        },
      ],
    });

    const preview = buildExistingWorkflowPreview({
      workflow,
      watchPath: "/Users/coffeedev/Documents/inbox",
      recursive: true,
      fileGlob: "*.*",
    });

    expect(preview.summary).toContain("Runs your saved workflow");
    expect(preview.originalFile).toContain("may not move or organize");
    expect(preview.gptOssCount).toBe(0);
  });

  it("describes file_sort workflows as moving original files", () => {
    const workflow = makeWorkflow({
      name: "Sort files to Contracts",
      nodes: [
        {
          id: "sort-1",
          node_type: "file_sort",
          position: { x: 0, y: 0 },
          data: {
            destination_path: "/Users/coffeedev/Documents/Contracts",
            operation: "move",
            conflict_policy: "keep_both",
          },
        },
      ],
    });

    const preview = buildExistingWorkflowPreview({
      workflow,
      watchPath: "/Users/coffeedev/Documents/inbox",
      recursive: true,
      fileGlob: "*.pdf",
    });

    expect(preview.summary).toContain("Moves each matching file");
    expect(preview.originalFile).toBe("Original file is moved into the destination folder.");
    expect(preview.outputs.map((output) => output.path)).toEqual([
      "/Users/coffeedev/Documents/Contracts",
      "Recent Automations",
    ]);
  });
});
