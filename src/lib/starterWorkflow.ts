import { v4 as uuidv4 } from "uuid";
import type { Workflow } from "@/types/workflow";

const DEFAULT_WORKFLOW_NAME = "GPT-OSS Starter Workflow";
const DEFAULT_PROMPT = "Summarize the trigger file in concise bullet points.";

interface CreateStarterWorkflowParams {
  name?: string;
  prompt?: string;
}

export function createGptOssStarterWorkflow(
  params: CreateStarterWorkflowParams = {}
): Workflow {
  const createdAt = new Date().toISOString();
  const textInputId = `text_input-${uuidv4()}`;
  const aiAgentId = `ai_agent-${uuidv4()}`;
  const textOutputId = `text_output-${uuidv4()}`;
  const name = params.name ?? DEFAULT_WORKFLOW_NAME;
  const prompt = params.prompt?.trim() || DEFAULT_PROMPT;

  return {
    id: uuidv4(),
    name,
    created_at: createdAt,
    updated_at: createdAt,
    nodes: [
      {
        id: textInputId,
        node_type: "text_input",
        position: { x: 120, y: 200 },
        data: {
          text: prompt,
        },
      },
      {
        id: aiAgentId,
        node_type: "ai_agent",
        position: { x: 430, y: 200 },
        data: {
          provider: "ollama",
          model: "gpt-oss:20b",
          base_url: "http://192.168.86.32:11434",
          temperature: 0.7,
          tool_mode: true,
          tool_profile: "doc_pipeline_v1",
          max_tool_rounds: 4,
          processed_output_mode: "sibling_processed",
          system_message:
            "You are Synapse's local automation AI. Produce reliable file-processing outputs.",
        },
      },
      {
        id: textOutputId,
        node_type: "text_output",
        position: { x: 760, y: 200 },
        data: {},
      },
    ],
    edges: [
      {
        id: `edge-${textInputId}-${aiAgentId}`,
        source: textInputId,
        target: aiAgentId,
        source_handle: "output",
        target_handle: "input",
      },
      {
        id: `edge-${aiAgentId}-${textOutputId}`,
        source: aiAgentId,
        target: textOutputId,
        source_handle: "output",
        target_handle: "input",
      },
    ],
  };
}
