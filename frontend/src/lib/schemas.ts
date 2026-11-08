import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "VIEWER"]),
});

export type RegisterFormData = z.infer<typeof RegisterSchema>;

export const MonitorSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
  url: z.string().url("Must be a valid HTTP or HTTPS URL"),
  method: z.enum(["GET", "POST", "HEAD"]),
  expected_status: z.number().int().min(100).max(599),
  interval_seconds: z.number().int().min(5).max(86400),
  timeout_ms: z.number().int().min(500).max(60000),
});

export type MonitorFormData = z.infer<typeof MonitorSchema>;

export const AlertChannelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  webhook_url: z.string().url("Must be a valid webhook URL"),
});

export type AlertChannelFormData = z.infer<typeof AlertChannelSchema>;

export const CheckEventSchema = z.object({
  monitor_id: z.string(),
  user_id: z.string(),
  status: z.enum(["UP", "DOWN", "PAUSED", "PENDING"]),
  status_changed: z.boolean(),
  status_code: z.number().nullable().optional(),
  latency_ms: z.number(),
  dns_ms: z.number().default(0),
  tls_ms: z.number().default(0),
  ttfb_ms: z.number().default(0),
  is_up: z.boolean(),
  error_message: z.string().nullable().optional(),
  checked_at: z.string(),
});

export type CheckEvent = z.infer<typeof CheckEventSchema>;

export interface CheckResultSummary {
  id?: number;
  status_code?: number | null;
  latency_ms: number;
  dns_ms?: number;
  tls_ms?: number;
  ttfb_ms?: number;
  is_up: boolean;
  error_message?: string | null;
  checked_at: string;
}

export interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  expected_status: number;
  interval_seconds: number;
  timeout_ms: number;
  status: "UP" | "DOWN" | "PAUSED" | "PENDING";
  consecutive_failures: number;
  is_active: boolean;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  uptime_24h?: number | null;
  avg_latency_24h?: number;
  total_checks?: number;
  recent_checks?: CheckResultSummary[];
}

export interface LatencyBucket {
  bucket: string;
  total_checks: number;
  uptime_pct: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface Incident {
  id: string;
  monitor_id: string;
  monitor_name?: string;
  status: "OPEN" | "RESOLVED";
  cause: string;
  started_at: string;
  resolved_at?: string | null;
  duration_seconds?: number;
}

export interface AlertChannel {
  id: string;
  user_id: string;
  name: string;
  webhook_url: string;
  is_enabled: boolean;
  created_at: string;
}
