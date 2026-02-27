import { describe, expect, it, vi } from "vitest";
import { formatHealthAge, mapGptOssStatusToDisplay } from "@/lib/gptOssStatus";

describe("gptOssStatus mapping", () => {
  it("maps connected state to success display", () => {
    const display = mapGptOssStatusToDisplay({
      state: "connected",
      model: "gpt-oss:20b",
      base_url: "http://192.168.86.32:11434",
    });
    expect(display.tone).toBe("success");
    expect(display.headline).toContain("Active");
  });

  it("maps model_missing state to warning display", () => {
    const display = mapGptOssStatusToDisplay({
      state: "model_missing",
      model: "gpt-oss:20b",
      base_url: "http://192.168.86.32:11434",
    });
    expect(display.tone).toBe("warning");
    expect(display.headline).toContain("missing");
  });

  it("maps disconnected state to danger display", () => {
    const display = mapGptOssStatusToDisplay({
      state: "disconnected",
      model: "gpt-oss:20b",
      base_url: "http://192.168.86.32:11434",
      error: "connect ECONNREFUSED",
    });
    expect(display.tone).toBe("danger");
    expect(display.detail).toContain("ECONNREFUSED");
  });
});

describe("formatHealthAge", () => {
  it("formats recent checks", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(formatHealthAge(999_998)).toBe("just now");
    expect(formatHealthAge(940_000)).toBe("1m ago");
    nowSpy.mockRestore();
  });
});
