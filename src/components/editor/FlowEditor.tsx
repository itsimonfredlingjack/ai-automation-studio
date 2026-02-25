import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useFlowStore } from "@/stores/flowStore";
import { nodeTypes } from "@/components/nodes/nodeTypes";
import { NodePalette } from "./NodePalette";
import { Toolbar } from "./Toolbar";
import { ExecutionResults } from "./ExecutionResults";

export function FlowEditor() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } =
    useFlowStore();

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/synapse-node");
      if (!nodeType) return;

      const reactFlowBounds = (
        event.target as HTMLElement
      ).closest(".react-flow")?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {},
      };

      addNode(newNode);
    },
    [addNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar />
      <div className="relative flex-1">
        <NodePalette />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls className="!bg-card !border-border !shadow-sm" />
          <MiniMap
            className="!bg-card !border-border !shadow-sm"
            nodeColor="#888"
            maskColor="rgba(0,0,0,0.08)"
          />
        </ReactFlow>
        <ExecutionResults />
      </div>
    </div>
  );
}
