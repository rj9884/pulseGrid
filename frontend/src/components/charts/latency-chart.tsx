"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { LatencyBucket } from "@/lib/schemas";

interface LatencyChartProps {
  data: LatencyBucket[];
}

export function LatencyChart({ data }: LatencyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
        No latency data recorded in the last 24 hours.
      </div>
    );
  }

  const formatted = data.map((d) => ({
    time: new Date(d.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    p50: Math.round(d.p50_ms),
    p95: Math.round(d.p95_ms),
    p99: Math.round(d.p99_ms),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} unit="ms" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              borderColor: "#27272a",
              borderRadius: "0.5rem",
              color: "#f4f4f5",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="p50 Latency"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="p95"
            name="p95 Latency"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="p99"
            name="p99 Latency"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
