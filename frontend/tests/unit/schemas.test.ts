import { describe, it, expect } from "vitest";
import { LoginSchema, RegisterSchema, MonitorSchema } from "@/lib/schemas";

describe("Zod Validation Schemas", () => {
  it("validates correct login credentials", () => {
    const valid = LoginSchema.safeParse({
      email: "engineer@pulsegrid.dev",
      password: "strongPassword123",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid login email", () => {
    const invalid = LoginSchema.safeParse({
      email: "invalid-email-format",
      password: "password123",
    });
    expect(invalid.success).toBe(false);
  });

  it("enforces minimum 8 char password on registration", () => {
    const invalid = RegisterSchema.safeParse({
      email: "engineer@pulsegrid.dev",
      password: "short",
      role: "ADMIN",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates monitor configuration", () => {
    const parsed = MonitorSchema.parse({
      name: "API Healthcheck",
      url: "https://api.example.com/health",
      method: "GET",
      expected_status: 200,
      interval_seconds: 60,
      timeout_ms: 5000,
    });
    expect(parsed.method).toBe("GET");
    expect(parsed.expected_status).toBe(200);
    expect(parsed.interval_seconds).toBe(60);
    expect(parsed.timeout_ms).toBe(5000);
  });

  it("rejects monitor with non-url string", () => {
    const invalid = MonitorSchema.safeParse({
      name: "Bad Monitor",
      url: "not-a-valid-url",
    });
    expect(invalid.success).toBe(false);
  });
});
