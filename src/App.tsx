import { ReactFlowProvider } from "@xyflow/react";
import { FlowEditor } from "@/components/editor/FlowEditor";
import { Sidebar } from "@/components/layout/Sidebar";
import { AutomationCommandOverlay } from "@/components/layout/AutomationCommandOverlay";

function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex-1">
          <FlowEditor />
        </main>
        <AutomationCommandOverlay />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
