export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  node_type: string;
  position: Position;
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}
