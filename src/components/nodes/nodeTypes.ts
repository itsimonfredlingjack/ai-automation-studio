import { FileSortNode } from "./FileSortNode";
import { TextInputNode } from "./TextInputNode";
import { TextTransformNode } from "./TextTransformNode";
import { TextOutputNode } from "./TextOutputNode";
import { CodeJsNode } from "./CodeJsNode";
import { AiAgentNode } from "./AiAgentNode";
import { SwitchNode } from "./SwitchNode";
import { WebhookTriggerNode } from "./WebhookTriggerNode";
import { WebhookRespondNode } from "./WebhookRespondNode";

export const nodeTypes = {
  file_sort: FileSortNode,
  text_input: TextInputNode,
  text_transform: TextTransformNode,
  text_output: TextOutputNode,
  code_js: CodeJsNode,
  ai_agent: AiAgentNode,
  switch: SwitchNode,
  webhook_trigger: WebhookTriggerNode,
  webhook_respond: WebhookRespondNode,
};

export const NODE_PALETTE = [
  {
    type: "webhook_trigger",
    label: "Webhook Trigger",
    color: "bg-cyan-500",
    description: "Receive HTTP requests to trigger a workflow",
  },
  {
    type: "text_input",
    label: "Text Input",
    color: "bg-blue-500",
    description: "Enter text to pass through the workflow",
  },
  {
    type: "text_transform",
    label: "Text Transform",
    color: "bg-amber-500",
    description: "Transform text (uppercase, lowercase, trim, reverse)",
  },
  {
    type: "code_js",
    label: "Code (JS)",
    color: "bg-purple-500",
    description: "Execute custom JavaScript code",
  },
  {
    type: "ai_agent",
    label: "AI Agent",
    color: "bg-indigo-500",
    description: "Call AI models and run doc pipeline tools",
  },
  {
    type: "switch",
    label: "Switch",
    color: "bg-orange-500",
    description: "Conditional routing based on input data",
  },
  {
    type: "text_output",
    label: "Text Output",
    color: "bg-green-500",
    description: "Display the final output",
  },
  {
    type: "webhook_respond",
    label: "Respond Webhook",
    color: "bg-teal-500",
    description: "Send HTTP response back to the caller",
  },
] as const;
