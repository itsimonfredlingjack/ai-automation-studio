import { describe, expect, it } from "vitest";
import { getSetupTrackById, SETUP_TRACKS } from "@/lib/setupTracks";

describe("setupTracks", () => {
  it("lists organize files first as available now", () => {
    expect(SETUP_TRACKS[0].id).toBe("organize_files");
    expect(SETUP_TRACKS[0].availability).toBe("available");
    expect(SETUP_TRACKS[0].examples[0]).toContain("Sort files into the right folders");
  });

  it("marks understand contents as available now", () => {
    const track = getSetupTrackById("understand_contents");
    expect(track.availability).toBe("available");
    expect(track.ctaLabel).toContain("Use available GPT-OSS");
  });
});
