import { describe, it, expect } from "vitest";
import { LoginSchema, RegisterSchema, MonitorSchema, AlertChannelSchema, CheckEventSchema } from "@/lib/schemas";

describe("Zod Schemas", () => {
  describe("LoginSchema", () => {
    it("validates correct email and password", () => {
      const result = LoginSchema.safeParse({ email: "test@example.com", password: "password123" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = LoginSchema.safeParse({ email: "not-an-email", password: "password123" });
      expect(result.success).toBe(false);
    });

    it("rejects empty password", () => {
      const result = LoginSchema.safeParse({ email: "test@example.com", password: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("RegisterSchema", () => {
    it("validates correct registration data", () => {
      const result = RegisterSchema.safeParse({ email: "test@example.com", password: "password123", role: "ADMIN" });
      expect(result.success).toBe(true);
    });

    it("rejects password shorter than 8 chars", () => {
      const result = RegisterSchema.safeParse({ email: "test@example.com", password: "short", role: "ADMIN" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid role", () => {
      const result = RegisterSchema.safeParse({ email: "test@example.com", password: "password123", role: "INVALID" });
      expect(result.success).toBe(false);
    });
  });

  describe("MonitorSchema", () => {
    it("validates correct monitor data", () => {
      const result = MonitorSchema.safeParse({
        name: "Test Monitor",
        url: "https://example.com/health",
        method: "GET",
        expected_status: 200,
        interval_seconds: 60,
        timeout_ms: 5000,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = MonitorSchema.safeParse({
        name: "",
        url: "https://example.com",
        method: "GET",
        expected_status: 200,
        interval_seconds: 60,
        timeout_ms: 5000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL", () => {
      const result = MonitorSchema.safeParse({
        name: "Test",
        url: "not-a-url",
        method: "GET",
        expected_status: 200,
        interval_seconds: 60,
        timeout_ms: 5000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects interval too short", () => {
      const result = MonitorSchema.safeParse({
        name: "Test",
        url: "https://example.com",
        method: "GET",
        expected_status: 200,
        interval_seconds: 2,
        timeout_ms: 5000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AlertChannelSchema", () => {
    it("validates correct alert channel data", () => {
      const result = AlertChannelSchema.safeParse({
        name: "Slack Webhook",
        webhook_url: "https://hooks.slack.com/services/xxx",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid webhook URL", () => {
      const result = AlertChannelSchema.safeParse({
        name: "Test",
        webhook_url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CheckEventSchema", () => {
    it("validates correct check event", () => {
      const result = CheckEventSchema.safeParse({
        monitor_id: "123e4567-e89b-12d3-a456-426614174000",
        user_id: "123e4567-e89b-12d3-a456-426614174001",
        status: "UP",
        status_changed: false,
        status_code: 200,
        latency_ms: 150,
        dns_ms: 10,
        connect_ms: 20,
        tls_ms: 30,
        ttfb_ms: 90,
        is_up: true,
        error_message: null,
        checked_at: "2024-01-01T00:00:00Z",
      });
      expect(result.success).toBe(true);
    });
  });
});