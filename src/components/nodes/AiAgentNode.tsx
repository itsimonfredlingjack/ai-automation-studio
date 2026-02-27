import { memo, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";

type AiAgentNodeData = Node<{
  provider?: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  system_message?: string;
  temperature?: number;
  tool_mode?: boolean;
  tool_profile?: "doc_pipeline_v1";
  max_tool_rounds?: number;
  processed_output_mode?: "sibling_processed";
}>;

const PROVIDERS = [
  {
    value: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultUrl: "https://api.openai.com/v1",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    defaultUrl: "https://api.anthropic.com",
  },
  {
    value: "ollama",
    label: "Ollama",
    defaultModel: "llama3",
    defaultUrl: "http://localhost:11434",
  },
] as const;
const TOOL_NAMES = [
  "extract_pdf_text",
  "read_text_file",
  "write_text_file",
  "write_json_file",
  "ensure_dir",
];

function AiAgentNodeComponent({ data, id }: NodeProps<AiAgentNodeData>) {
  const { updateNodeData } = useReactFlow();
  const d = data as Record<string, unknown>;

  const provider = (d.provider as string) ?? "openai";
  const toolMode = (d.tool_mode as boolean) ?? false;
  const providerInfo =
    PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  const update = useCallback(
    (field: string, value: unknown) => {
      updateNodeData(id, { [field]: value });
    },
    [id, updateNodeData],
  );

  const onProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const p =
        PROVIDERS.find((pr) => pr.value === e.target.value) ?? PROVIDERS[0];
      updateNodeData(id, {
        provider: p.value,
        model: p.defaultModel,
        base_url: p.defaultUrl,
      });
    },
    [id, updateNodeData],
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[300px]">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
        <span className="text-sm font-medium text-card-foreground">
          AI Agent
        </span>
      </div>

      <div className="space-y-2">
        <button
          className="w-full rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/20 transition-colors text-left"
          onClick={() => {
            updateNodeData(id, {
              provider: "ollama",
              model: "gpt-oss:20b",
              base_url: "http://192.168.86.32:11434",
              temperature: 0.7,
              tool_mode: true,
              tool_profile: "doc_pipeline_v1",
              max_tool_rounds: 4,
              processed_output_mode: "sibling_processed",
            });
          }}
        >
          Local GPT-OSS 20B
        </button>

        <select
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={provider}
          onChange={onProviderChange}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="flex items-center justify-between rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground">
          Tool mode (Beta)
          <input
            type="checkbox"
            checked={toolMode}
            onChange={(e) => update("tool_mode", e.target.checked)}
          />
        </label>
        {toolMode && (
          <div className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1.5 text-[11px] text-indigo-200">
            <p className="font-medium">Document Pipeline v1</p>
            <p className="mt-1 text-indigo-300">Allowlisted tools: {TOOL_NAMES.join(", ")}</p>
          </div>
        )}

        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Model name"
          value={(d.model as string) ?? providerInfo.defaultModel}
          onChange={(e) => update("model", e.target.value)}
        />

        {provider !== "ollama" && (
          <input
            type="password"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="API Key"
            value={(d.api_key as string) ?? ""}
            onChange={(e) => update("api_key", e.target.value)}
          />
        )}

        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Base URL"
          value={(d.base_url as string) ?? providerInfo.defaultUrl}
          onChange={(e) => update("base_url", e.target.value)}
        />

        <textarea
          className="w-full min-h-[50px] rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          placeholder="System message (optional)"
          value={(d.system_message as string) ?? ""}
          onChange={(e) => update("system_message", e.target.value)}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Temp:
          </span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            className="flex-1"
            value={(d.temperature as number) ?? 0.7}
            onChange={(e) => update("temperature", parseFloat(e.target.value))}
          />
          <span className="text-xs text-muted-foreground w-8 text-right">
            {((d.temperature as number) ?? 0.7).toFixed(1)}
          </span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-indigo-500 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-indigo-500 !border-2 !border-background"
      />
    </div>
  );
}

export const AiAgentNode = memo(AiAgentNodeComponent);
