import type { Edge, Node } from "@xyflow/react";
import type { Workflow } from "@/types/workflow";

interface BuildWorkflowPayloadParams {
  workflowId: string;
  name: string;
  description?: string;
  createdAt: string;
  nodes: Node[];
  edges: Edge[];
}

export function buildWorkflowPayload({
  workflowId,
  name,
  description,
  createdAt,
  nodes,
  edges,
}: BuildWorkflowPayloadParams): Workflow {
  return {
    id: workflowId,
    name,
    description,
    nodes: nodes.map((node) => ({
      id: node.id,
      node_type: node.type ?? "text_input",
      position: { x: node.position.x, y: node.position.y },
      data: node.data as Record<string, unknown>,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      source_handle: edge.sourceHandle ?? undefined,
      target_handle: edge.targetHandle ?? undefined,
    })),
    created_at: createdAt,
    updated_at: new Date().toISOString(),
  };
}
