import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";

describe("Utility Functions", () => {
  describe("cn", () => {
    it("joins class names correctly", () => {
      expect(cn("a", "b", "c")).toBe("a b c");
    });

    it("handles conditional classes", () => {
      expect(cn("base", true && "conditional", false && "hidden")).toBe("base conditional");
    });

    it("handles empty strings", () => {
      expect(cn("", "a")).toBe("a");
    });

    it("handles objects with tailwind-merge", () => {
      expect(cn("p-2 p-4")).toBe("p-4");
      expect(cn("text-red-500 text-blue-500")).toBe("text-blue-500");
    });
  });

  describe("formatDuration", () => {
    it("formats seconds correctly", () => {
      expect(formatDuration(30)).toBe("30s");
    });

    it("formats minutes correctly", () => {
      expect(formatDuration(120)).toBe("2m 0s");
    });

    it("formats hours correctly", () => {
      expect(formatDuration(7200)).toBe("2h 0m");
    });

    it("handles zero", () => {
      expect(formatDuration(0)).toBe("0s");
    });
  });
});