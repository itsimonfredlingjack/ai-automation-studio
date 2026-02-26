import { describe, expect, it } from "vitest";
import {
  createTemplateInviteMessage,
  createTemplatePayload,
  parseTemplateInput,
} from "@/lib/templateShare";
import type { Workflow } from "@/types/workflow";

function encodePayload(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("templateShare", () => {
  const workflow: Workflow = {
    id: "wf-1",
    name: "Lead Router",
    nodes: [],
    edges: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  it("preserves remix metadata from template payload", () => {
    const encoded = encodePayload({
      version: 1,
      name: "My Workflow",
      nodes: [],
      edges: [],
      remix: {
        chain_depth: 2,
        root_template_name: "Lead Router",
      },
    });

    const parsed = parseTemplateInput(`synapse://template?data=${encoded}`);

    expect("remix" in parsed.payload).toBe(true);
    const remix = (parsed.payload as unknown as { remix?: { chain_depth: number } }).remix;
    expect(remix?.chain_depth).toBe(2);
  });

  it("includes remix chain copy in invite message", () => {
    const payload = createTemplatePayload(workflow, {
      remix: { chain_depth: 3, root_template_name: "Lead Router" },
    });

    const invite = createTemplateInviteMessage(workflow, { remix: payload.remix });

    expect(invite).toContain("Remix chain #3");
    expect(invite).toContain("Lead Router");
  });
});
