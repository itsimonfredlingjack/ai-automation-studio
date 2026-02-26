import {
  parseTemplateRemixMetadata,
} from "@/lib/templateRemix";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflow";
import type { WorkflowTemplatePayload } from "@/lib/templateShare";

export function parseTemplatePayload(value: unknown): WorkflowTemplatePayload {
  if (!isObject(value)) throw new Error("Invalid template payload.");

  const version = value.version;
  const name = value.name;
  const nodes = value.nodes;
  const edges = value.edges;
  const remix = parseTemplateRemixMetadata(value.remix);

  if (version !== 1) throw new Error("Unsupported template version.");
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Template name is invalid.");
  }
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error("Template graph is invalid.");
  }

  const payload: WorkflowTemplatePayload = {
    version: 1,
    name: name.trim(),
    nodes: nodes.map(parseNode),
    edges: edges.map(parseEdge),
  };
  if (remix) payload.remix = remix;
  return payload;
}

function parseNode(value: unknown): WorkflowNode {
  if (!isObject(value)) throw new Error("Template node is invalid.");
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
  if (!isObject(value)) throw new Error("Template edge is invalid.");
  if (
    typeof value.id !== "string" ||
    typeof value.source !== "string" ||
    typeof value.target !== "string"
  ) {
    throw new Error("Template edge identity is invalid.");
  }

  return {
    id: value.id,
    source: value.source,
    target: value.target,
    source_handle:
      typeof value.source_handle === "string" ? value.source_handle : undefined,
    target_handle:
      typeof value.target_handle === "string" ? value.target_handle : undefined,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
