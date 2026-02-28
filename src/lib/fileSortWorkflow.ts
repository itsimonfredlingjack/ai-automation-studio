import { v4 as uuidv4 } from "uuid";
import type { Workflow } from "@/types/workflow";

interface CreateFileSortWorkflowParams {
  name: string;
  destinationPath: string;
}

export function buildFileSortWorkflowName(destinationPath: string): string {
  const normalized = destinationPath.replaceAll("\\", "/");
  const folderName = normalized.split("/").filter(Boolean).pop() ?? "Folder";
  return `Sort files to ${folderName}`;
}

export function createFileSortWorkflow(
  params: CreateFileSortWorkflowParams
): Workflow {
  const createdAt = new Date().toISOString();

  return {
    id: uuidv4(),
    name: params.name,
    description: `Moves matching files into ${params.destinationPath}`,
    created_at: createdAt,
    updated_at: createdAt,
    nodes: [
      {
        id: `file_sort-${uuidv4()}`,
        node_type: "file_sort",
        position: { x: 320, y: 220 },
        data: {
          destination_path: params.destinationPath,
          operation: "move",
          conflict_policy: "keep_both",
        },
      },
    ],
    edges: [],
  };
}
