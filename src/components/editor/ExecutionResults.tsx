import { X, ChevronUp, ChevronDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useExecutionStore } from "@/stores/executionStore";
import { useState } from "react";

export function ExecutionResults() {
  const { result, error, mode, showResults, closeResults } =
    useExecutionStore();
  const [expanded, setExpanded] = useState(true);

  if (!showResults) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-border bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          {error ? (
            <XCircle size={14} className="text-destructive" />
          ) : (
            <CheckCircle2 size={14} className="text-green-500" />
          )}
          <span className="text-xs font-medium">
            {error ? "Execution Failed" : "Execution Complete"}
          </span>
          {result && (
            <span className="text-xs text-muted-foreground">
              <Clock size={12} className="inline mr-1" />
              {result.total_duration_ms}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            onClick={closeResults}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="max-h-64 overflow-y-auto p-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && mode === "test" && result.steps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Step-by-step execution
              </h4>
              {result.steps.map((step, i) => (
                <div
                  key={`${step.node_id}-${i}`}
                  className="flex items-start gap-3 rounded-md border border-border p-2 text-sm"
                >
                  <span className="flex-shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {step.node_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {step.duration_ms}ms
                      </span>
                    </div>
                    {Object.keys(step.outputs).length > 0 && (
                      <pre className="mt-1 rounded bg-muted p-2 text-xs text-muted-foreground overflow-x-auto">
                        {JSON.stringify(step.outputs, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result &&
            (mode === "execute" || result.steps.length === 0) &&
            Object.keys(result.final_outputs).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Output
                </h4>
                <pre className="rounded-md bg-muted p-3 text-sm text-foreground overflow-x-auto">
                  {JSON.stringify(result.final_outputs, null, 2)}
                </pre>
              </div>
            )}

          {result && Object.keys(result.final_outputs).length === 0 && !error && (
            <p className="text-sm text-muted-foreground">
              Workflow executed successfully with no output.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
