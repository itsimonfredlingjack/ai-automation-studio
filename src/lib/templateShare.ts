import type { Workflow, WorkflowEdge, WorkflowNode } from "@/types/workflow";
import { type TemplateRemixMetadata } from "@/lib/templateRemix";
import { parseTemplatePayload } from "@/lib/templatePayloadParser";

export interface WorkflowTemplatePayload {
  version: 1;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  remix?: TemplateRemixMetadata;
}

export type TemplateInputSource =
  | "raw_link"
  | "encoded_payload"
  | "invite_message";

export interface ParsedTemplateInput {
  payload: WorkflowTemplatePayload;
  source: TemplateInputSource;
}

interface TemplatePayloadOptions {
  remix?: TemplateRemixMetadata;
}

const TEMPLATE_PREFIX = "synapse://template?data=";
const RAW_LINK_PATTERN = /^synapse:\/\/template\?data=([A-Za-z0-9\-_]+)$/;
const ENCODED_PATTERN = /^[A-Za-z0-9\-_]+$/;
const EMBEDDED_LINK_PATTERN = /synapse:\/\/template\?data=([A-Za-z0-9\-_]+)/;

export function createTemplatePayload(
  workflow: Workflow,
  options: TemplatePayloadOptions = {}
): WorkflowTemplatePayload {
  const payload: WorkflowTemplatePayload = {
    version: 1,
    name: workflow.name,
    nodes: workflow.nodes,
    edges: workflow.edges,
  };

  if (options.remix) {
    payload.remix = options.remix;
  }

  return payload;
}

export function createTemplateLink(payload: WorkflowTemplatePayload): string {
  return `${TEMPLATE_PREFIX}${encodePayload(payload)}`;
}

export function createTemplateInviteMessage(
  workflow: Workflow,
  options: TemplatePayloadOptions = {}
): string {
  const payload = createTemplatePayload(workflow, options);
  const link = createTemplateLink(payload);
  const lines = [
    `I built "${workflow.name}" in Synapse.`,
    `${workflow.nodes.length} nodes, ${workflow.edges.length} connections.`,
  ];

  if (payload.remix) {
    lines.push(
      `Remix chain #${payload.remix.chain_depth} from "${payload.remix.root_template_name}".`
    );
  }

  lines.push(
    "Open Synapse, paste this full message into the import box, and click import:",
    link
  );
  return lines.join("\n");
}

export function parseTemplateInput(value: string): ParsedTemplateInput {
  const { encoded, source } = extractEncodedPayload(value);
  if (!encoded) {
    throw new Error("Template link is empty.");
  }

  const decoded = decodePayload(encoded);
  const parsed: unknown = JSON.parse(decoded);
  return {
    payload: parseTemplatePayload(parsed),
    source,
  };
}

export function parseTemplateLink(value: string): WorkflowTemplatePayload {
  return parseTemplateInput(value).payload;
}

function extractEncodedPayload(
  value: string
): { encoded: string; source: TemplateInputSource } {
  const trimmed = value.trim();
  const rawLinkMatch = trimmed.match(RAW_LINK_PATTERN);
  if (rawLinkMatch) {
    return { encoded: rawLinkMatch[1], source: "raw_link" };
  }

  if (ENCODED_PATTERN.test(trimmed)) {
    return { encoded: trimmed, source: "encoded_payload" };
  }

  const embeddedMatch = trimmed.match(EMBEDDED_LINK_PATTERN);
  if (embeddedMatch) {
    return { encoded: embeddedMatch[1], source: "invite_message" };
  }

  throw new Error("No template link found in pasted text.");
}

function encodePayload(payload: WorkflowTemplatePayload): string {
  const text = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(text);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodePayload(encoded: string): string {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
