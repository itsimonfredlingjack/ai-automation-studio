import { ReactFlowProvider } from "@xyflow/react";
import { FlowEditor } from "@/components/editor/FlowEditor";
import { Sidebar } from "@/components/layout/Sidebar";

function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex-1">
          <FlowEditor />
        </main>
      </div>
    </ReactFlowProvider>
  );
}

export default App;
