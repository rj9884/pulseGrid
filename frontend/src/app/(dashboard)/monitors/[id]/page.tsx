"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, Clock, ShieldCheck, Zap } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Monitor, LatencyBucket } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LatencyChart } from "@/components/charts/latency-chart";
import { UptimeBar } from "@/components/ui/uptime-bar";

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
      <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-xs sm:text-sm text-text-muted">
          Loading monitor telemetry stream...
        </div>
      </div>
    );
  }

  const { monitor, metrics } = data;

  return (
    <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1 space-y-7">
        {/* Back Link & Header */}
        <div className="flex flex-col space-y-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 text-xs text-text-muted hover:text-white transition-colors w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Monitors</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{monitor.name}</h1>
                <Badge
                  variant={
                    monitor.status === "UP"
                      ? "success"
                      : monitor.status === "DOWN"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  <span className="flex items-center space-x-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        monitor.status === "UP"
                          ? "bg-emerald-400"
                          : monitor.status === "DOWN"
                          ? "bg-red-400"
                          : "bg-zinc-400"
                      }`}
                    />
                    <span>{monitor.status}</span>
                  </span>
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-text-muted font-mono mt-1.5 flex items-center space-x-2">
                <span className="bg-surface-card border border-border-subtle px-1.5 py-0.5 rounded text-[11px] text-text-primary font-semibold">
                  {monitor.method}
                </span>
                <span className="text-text-secondary">{monitor.url}</span>
              </p>
            </div>
          </div>

          {/* Integrated Uptime Bar */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                30-Day Availability & Uptime History
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {monitor.uptime_24h ?? 100}% Operational
              </span>
            </div>
            <UptimeBar uptime={monitor.uptime_24h ?? 100} barCount={48} />
          </Card>
        </div>

        {/* Config Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-medium text-text-muted">Check Interval</p>
            <p className="mt-1 text-xl font-bold text-white font-mono">{monitor.interval_seconds}s</p>
          </Card>
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-medium text-text-muted">Timeout Deadline</p>
            <p className="mt-1 text-xl font-bold text-white font-mono">{monitor.timeout_ms}ms</p>
          </Card>
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-medium text-text-muted">Expected HTTP Code</p>
            <p className="mt-1 text-xl font-bold text-white font-mono">{monitor.expected_status}</p>
          </Card>
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-medium text-text-muted">Consecutive Failures</p>
            <p className={`mt-1 text-xl font-bold font-mono ${monitor.consecutive_failures > 0 ? "text-amber-400" : "text-white"}`}>
              {monitor.consecutive_failures}
            </p>
          </Card>
        </div>

        {/* Latency Percentile Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">24-Hour Latency Profile (p50 / p95 / p99)</CardTitle>
                <CardDescription>
                  Granular phase breakdown aggregated over hourly buckets
                </CardDescription>
              </div>
              <ShieldCheck className="h-5 w-5 text-brand-hover opacity-90" />
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
              <div>
                <CardTitle className="text-base sm:text-lg">Recent Prober Executions</CardTitle>
                <CardDescription>
                  Real-time network phase waterfall breakdown (DNS, TLS handshake, TTFB)
                </CardDescription>
              </div>
              <span className="text-xs text-text-muted flex items-center space-x-1.5 font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>Live stream</span>
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {checks.length === 0 ? (
              <div className="text-center py-10 text-xs sm:text-sm text-text-muted">
                <Zap className="mx-auto h-6 w-6 text-text-muted/60 mb-2" />
                No prober checks recorded yet. Next cycle scheduled shortly.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border-subtle/80">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-default/80 bg-surface-card/50 text-text-muted uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">HTTP Code</th>
                      <th className="py-3 px-3.5">Total Latency</th>
                      <th className="py-3 px-3.5">DNS</th>
                      <th className="py-3 px-3.5">TLS</th>
                      <th className="py-3 px-3.5">TTFB</th>
                      <th className="py-3 px-3.5">Checked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 font-mono">
                    {checks.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-card/40 transition-colors">
                        <td className="py-2.5 px-3.5 font-sans">
                          {c.is_up ? (
                            <span className="inline-flex items-center space-x-1.5 text-emerald-400 font-semibold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>UP</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 text-red-400 font-semibold text-[11px] bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                              <XCircle className="h-3 w-3" />
                              <span>FAIL</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-text-primary">
                          <span className="bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle">
                            {c.status_code ?? "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-white">
                          {c.latency_ms}ms
                        </td>
                        <td className="py-2.5 px-3.5 text-text-muted">{c.dns_ms}ms</td>
                        <td className="py-2.5 px-3.5 text-text-muted">{c.tls_ms}ms</td>
                        <td className="py-2.5 px-3.5 text-text-muted">{c.ttfb_ms}ms</td>
                        <td className="py-2.5 px-3.5 text-text-muted font-sans">
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
