import { describe, it, expect } from "vitest";
import { formatDuration, formatLatency, cn } from "@/lib/utils";

describe("Frontend Utilities", () => {
  it("formats seconds into readable duration", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3665)).toBe("1h 1m");
  });

  it("formats millisecond latencies", () => {
    expect(formatLatency(150)).toBe("150ms");
    expect(formatLatency(1500)).toBe("1.50s");
  });

  it("merges class names correctly", () => {
    expect(cn("px-2", "py-2", "px-4")).toBe("py-2 px-4");
  });
});
