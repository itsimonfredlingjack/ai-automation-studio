import { describe, expect, it } from "vitest";
import { createGptOssStarterWorkflow } from "@/lib/starterWorkflow";

describe("createGptOssStarterWorkflow", () => {
  it("creates a valid starter workflow with gpt-oss ai settings", () => {
    const workflow = createGptOssStarterWorkflow("Starter");

    expect(workflow.name).toBe("Starter");
    expect(workflow.nodes).toHaveLength(3);
    expect(workflow.edges).toHaveLength(2);

    const aiNode = workflow.nodes.find((node) => node.node_type === "ai_agent");
    expect(aiNode).toBeDefined();
    expect(aiNode?.data.provider).toBe("ollama");
    expect(aiNode?.data.model).toBe("gpt-oss:20b");
    expect(aiNode?.data.base_url).toBe("http://192.168.86.32:11434");
    expect(aiNode?.data.tool_mode).toBe(true);
    expect(aiNode?.data.tool_profile).toBe("doc_pipeline_v1");
  });
});
