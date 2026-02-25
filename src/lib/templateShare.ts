import type { Workflow, WorkflowEdge, WorkflowNode } from "@/types/workflow";

export interface WorkflowTemplatePayload {
  version: 1;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const TEMPLATE_PREFIX = "synapse://template?data=";

export function createTemplatePayload(
  workflow: Workflow
): WorkflowTemplatePayload {
  return {
    version: 1,
    name: workflow.name,
    nodes: workflow.nodes,
    edges: workflow.edges,
  };
}

export function createTemplateLink(payload: WorkflowTemplatePayload): string {
  return `${TEMPLATE_PREFIX}${encodePayload(payload)}`;
}

export function parseTemplateLink(value: string): WorkflowTemplatePayload {
  const trimmed = value.trim();
  const encoded = trimmed.startsWith(TEMPLATE_PREFIX)
    ? trimmed.slice(TEMPLATE_PREFIX.length)
    : trimmed;

  if (!encoded) {
    throw new Error("Template link is empty.");
  }

  const decoded = decodePayload(encoded);
  const parsed: unknown = JSON.parse(decoded);
  return parsePayload(parsed);
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

function parsePayload(value: unknown): WorkflowTemplatePayload {
  if (!isObject(value)) {
    throw new Error("Invalid template payload.");
  }

  const version = value.version;
  const name = value.name;
  const nodes = value.nodes;
  const edges = value.edges;

  if (version !== 1) {
    throw new Error("Unsupported template version.");
  }

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Template name is invalid.");
  }

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error("Template graph is invalid.");
  }

  return {
    version: 1,
    name: name.trim(),
    nodes: nodes.map(parseNode),
    edges: edges.map(parseEdge),
  };
}

function parseNode(value: unknown): WorkflowNode {
  if (!isObject(value)) {
    throw new Error("Template node is invalid.");
  }

  if (typeof value.id !== "string" || typeof value.node_type !== "string") {
    throw new Error("Template node identity is invalid.");
  }

  if (!isObject(value.position)) {
    throw new Error("Template node position is invalid.");
  }

  const position = value.position;
  if (typeof position.x !== "number" || typeof position.y !== "number") {
    throw new Error("Template node coordinates are invalid.");
  }

  return {
    id: value.id,
    node_type: value.node_type,
    position: { x: position.x, y: position.y },
    data: isObject(value.data) ? value.data : {},
  };
}

function parseEdge(value: unknown): WorkflowEdge {
  if (!isObject(value)) {
    throw new Error("Template edge is invalid.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.source !== "string" ||
    typeof value.target !== "string"
  ) {
    throw new Error("Template edge identity is invalid.");
  }

  const sourceHandle =
    typeof value.source_handle === "string" ? value.source_handle : undefined;
  const targetHandle =
    typeof value.target_handle === "string" ? value.target_handle : undefined;

  return {
    id: value.id,
    source: value.source,
    target: value.target,
    source_handle: sourceHandle,
    target_handle: targetHandle,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
