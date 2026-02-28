import { describe, expect, it } from "vitest";
import { createFileSortWorkflow } from "@/lib/fileSortWorkflow";

describe("createFileSortWorkflow", () => {
  it("creates a file_sort workflow with a fixed destination folder", () => {
    const workflow = createFileSortWorkflow({
      name: "Sort files to Contracts",
      destinationPath: "/Users/coffeedev/Documents/Contracts",
    });

    expect(workflow.name).toBe("Sort files to Contracts");
    expect(workflow.nodes).toHaveLength(1);
    expect(workflow.edges).toHaveLength(0);

    const fileSortNode = workflow.nodes[0];
    expect(fileSortNode?.node_type).toBe("file_sort");
    expect(fileSortNode?.data.destination_path).toBe(
      "/Users/coffeedev/Documents/Contracts"
    );
    expect(fileSortNode?.data.operation).toBe("move");
    expect(fileSortNode?.data.conflict_policy).toBe("keep_both");
  });
});
