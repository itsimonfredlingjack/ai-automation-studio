import type { Edge, Node } from "@xyflow/react";
import type { Workflow } from "@/types/workflow";

interface ReactFlowGraph {
  nodes: Node[];
  edges: Edge[];
}

export function toReactFlowGraph(workflow: Workflow): ReactFlowGraph {
  return {
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: node.node_type,
      position: { x: node.position.x, y: node.position.y },
      data: node.data,
    })),
    edges: workflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.source_handle ?? undefined,
      targetHandle: edge.target_handle ?? undefined,
    })),
  };
}
