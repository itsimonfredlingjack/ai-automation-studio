import { memo, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import { Plus, X } from "lucide-react";

interface Condition {
  operator: string;
  value: string;
  output_handle: string;
}

type SwitchNodeData = Node<{ conditions?: Condition[] }>;

const OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not contains" },
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "regex", label: "Regex" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Not empty" },
] as const;

function SwitchNodeComponent({ data, id }: NodeProps<SwitchNodeData>) {
  const { updateNodeData } = useReactFlow();
  const d = data as Record<string, unknown>;
  const conditions: Condition[] = (d.conditions as Condition[]) ?? [];

  const updateConditions = useCallback(
    (newConditions: Condition[]) => {
      updateNodeData(id, { conditions: newConditions });
    },
    [id, updateNodeData]
  );

  const addCondition = useCallback(() => {
    const idx = conditions.length;
    updateConditions([
      ...conditions,
      { operator: "contains", value: "", output_handle: `output_${idx}` },
    ]);
  }, [conditions, updateConditions]);

  const removeCondition = useCallback(
    (idx: number) => {
      updateConditions(conditions.filter((_, i) => i !== idx));
    },
    [conditions, updateConditions]
  );

  const updateCondition = useCallback(
    (idx: number, field: keyof Condition, value: string) => {
      const updated = [...conditions];
      updated[idx] = { ...updated[idx], [field]: value };
      updateConditions(updated);
    },
    [conditions, updateConditions]
  );

  const totalHandles = conditions.length + 1; // conditions + default

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[280px]">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
        <span className="text-sm font-medium text-card-foreground">Switch</span>
      </div>

      <div className="space-y-2">
        {conditions.map((cond, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select
              className="flex-shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={cond.operator}
              onChange={(e) => updateCondition(i, "operator", e.target.value)}
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {!["is_empty", "is_not_empty"].includes(cond.operator) && (
              <input
                className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Value"
                value={cond.value}
                onChange={(e) => updateCondition(i, "value", e.target.value)}
              />
            )}
            <button
              onClick={() => removeCondition(i)}
              className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <button
          onClick={addCondition}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Plus size={12} />
          Add condition
        </button>
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-orange-500 !border-2 !border-background"
      />

      {/* Output handles — one per condition + default */}
      {conditions.map((cond, i) => (
        <Handle
          key={cond.output_handle}
          type="source"
          position={Position.Right}
          id={cond.output_handle}
          className="!h-3 !w-3 !bg-orange-400 !border-2 !border-background"
          style={{ top: `${((i + 1) / (totalHandles + 1)) * 100}%` }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Right}
        id="default"
        className="!h-3 !w-3 !bg-orange-300 !border-2 !border-background"
        style={{ top: `${(totalHandles / (totalHandles + 1)) * 100}%` }}
      />
    </div>
  );
}

export const SwitchNode = memo(SwitchNodeComponent);
