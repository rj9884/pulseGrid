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
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border-default/60 bg-surface-card/20 text-xs sm:text-sm text-text-muted">
        No latency telemetry recorded in the last 24 hours.
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
    <div className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232738" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="#939db8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#232738" }}
          />
          <YAxis
            stroke="#939db8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#232738" }}
            unit="ms"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f101a",
              borderColor: "#2f3547",
              borderRadius: "0.75rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.8)",
              color: "#ffffff",
              fontSize: "12px",
              padding: "10px 14px",
            }}
            itemStyle={{ padding: "2px 0" }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: "12px", color: "#c9d3ee", paddingBottom: "12px" }}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="p50 Median"
            stroke="#5b63d3"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 5, fill: "#7c87f7", stroke: "#0f101a", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="p95"
            name="p95 Latency"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: "#fbbf24", stroke: "#0f101a", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="p99"
            name="p99 Tail Latency"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: "#f87171", stroke: "#0f101a", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
