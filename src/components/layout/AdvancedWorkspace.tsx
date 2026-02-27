import { FlowEditor } from "@/components/editor/FlowEditor";
import { Sidebar } from "@/components/layout/Sidebar";
import { AutomationCommandOverlay } from "@/components/layout/AutomationCommandOverlay";

export function AdvancedWorkspace() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1">
        <FlowEditor />
      </main>
      <AutomationCommandOverlay />
    </div>
  );
}
