"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Monitor, LatencyBucket } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LatencyChart } from "@/components/charts/latency-chart";

interface CheckItem {
  id: number;
  status_code: number | null;
  latency_ms: number;
  dns_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  is_up: boolean;
  error_message?: string | null;
  checked_at: string;
}

export default function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery<{ monitor: Monitor; metrics: LatencyBucket[] }>({
    queryKey: ["monitor-detail", id],
    queryFn: () => apiRequest(`/monitors/${id}`),
  });

  const { data: checks = [] } = useQuery<CheckItem[]>({
    queryKey: ["monitor-checks", id],
    queryFn: () => apiRequest(`/monitors/${id}/checks?limit=30`),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
          Loading monitor telemetry...
        </div>
      </div>
    );
  }

  const { monitor, metrics } = data;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 py-8 flex-1 space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col space-y-3">
          <Link
            href="/"
            className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Monitors</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold tracking-tight">{monitor.name}</h1>
                <Badge
                  variant={
                    monitor.status === "UP"
                      ? "success"
                      : monitor.status === "DOWN"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {monitor.status}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                {monitor.method} {monitor.url}
              </p>
            </div>
          </div>
        </div>

        {/* Config Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-zinc-400">Check Interval</p>
            <p className="mt-1 text-lg font-bold">{monitor.interval_seconds}s</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-zinc-400">Timeout Deadline</p>
            <p className="mt-1 text-lg font-bold">{monitor.timeout_ms}ms</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-zinc-400">Expected HTTP Code</p>
            <p className="mt-1 text-lg font-bold">{monitor.expected_status}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-zinc-400">Consecutive Failures</p>
            <p className="mt-1 text-lg font-bold text-amber-400">{monitor.consecutive_failures}</p>
          </Card>
        </div>

        {/* Latency Percentile Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">24-Hour Latency Profile (p50 / p95 / p99)</CardTitle>
                <p className="text-xs text-zinc-400 mt-1">
                  Granular phase breakdown aggregated over hourly buckets
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <LatencyChart data={metrics} />
          </CardContent>
        </Card>

        {/* Live Probing Audit Trail */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Check Executions</CardTitle>
              <span className="text-xs text-zinc-400 flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Auto-refreshed via SSE</span>
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {checks.length === 0 ? (
              <p className="text-sm text-zinc-500 py-6 text-center">No checks recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">HTTP Code</th>
                      <th className="py-2.5 px-3">Total Latency</th>
                      <th className="py-2.5 px-3">DNS</th>
                      <th className="py-2.5 px-3">TLS</th>
                      <th className="py-2.5 px-3">TTFB</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {checks.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 font-sans">
                          {c.is_up ? (
                            <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>UP</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1 text-red-400 font-semibold">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>FAIL</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-300">
                          {c.status_code ?? "—"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-200">
                          {c.latency_ms}ms
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400">{c.dns_ms}ms</td>
                        <td className="py-2.5 px-3 text-zinc-400">{c.tls_ms}ms</td>
                        <td className="py-2.5 px-3 text-zinc-400">{c.ttfb_ms}ms</td>
                        <td className="py-2.5 px-3 text-zinc-500 font-sans">
                          {new Date(c.checked_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
