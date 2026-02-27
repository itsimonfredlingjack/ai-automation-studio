import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/time";

const NOW = new Date("2026-02-27T12:00:00.000Z").getTime();

describe("formatRelativeTime", () => {
  it("formats sub-minute timestamps as just now", () => {
    expect(formatRelativeTime("2026-02-27T11:59:45.000Z", NOW)).toBe("just now");
  });

  it("formats minute and hour windows", () => {
    expect(formatRelativeTime("2026-02-27T11:45:00.000Z", NOW)).toBe("15m ago");
    expect(formatRelativeTime("2026-02-27T10:00:00.000Z", NOW)).toBe("2h ago");
  });

  it("formats day windows and invalid timestamps", () => {
    expect(formatRelativeTime("2026-02-25T12:00:00.000Z", NOW)).toBe("2d ago");
    expect(formatRelativeTime("invalid", NOW)).toBe("unknown");
  });
});
