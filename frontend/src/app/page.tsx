"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pause, Play, Trash2, ArrowUpRight, Activity, AlertCircle, CheckCircle2, Globe } from "lucide-react";
import { apiRequest, getAccessToken } from "@/lib/api";
import { Monitor, MonitorFormData } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { UptimeBar } from "@/components/ui/uptime-bar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MonitorSchema } from "@/lib/schemas";

const emptySubscribe = () => () => {};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: monitors = [], isLoading } = useQuery<Monitor[]>({
    queryKey: ["monitors"],
    queryFn: () => apiRequest<Monitor[]>("/monitors"),
    enabled: typeof window !== "undefined" && !!getAccessToken(),
  });

  const showLoading = !mounted || isLoading;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MonitorFormData>({
    resolver: zodResolver(MonitorSchema),
    defaultValues: {
      name: "",
      url: "",
      method: "GET",
      expected_status: 200,
      interval_seconds: 60,
      timeout_ms: 5000,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: MonitorFormData) =>
      apiRequest<Monitor>("/monitors", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err: Error) => {
      setModalError(err.message || "Failed to create monitor");
    },
  });

  const togglePauseMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/monitors/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/monitors/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const totalMonitors = monitors.length;
  const upMonitors = monitors.filter((m) => m.status === "UP").length;
  const downMonitors = monitors.filter((m) => m.status === "DOWN").length;
  const monitorsWithData = monitors.filter(
    (m) => (m.total_checks ?? 0) > 0 && m.uptime_24h !== null && m.uptime_24h !== undefined
  );
  const avgUptime = monitorsWithData.length > 0
    ? (monitorsWithData.reduce((acc, m) => acc + (m.uptime_24h ?? 0), 0) / monitorsWithData.length).toFixed(2)
    : "—";

  return (
    <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1 space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Telemetry & Uptime Monitor
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Distributed prober engine with millisecond-precision health checks & incident streaming
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Monitor</span>
          </Button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Total Monitors</span>
              <Activity className="h-4 w-4 text-brand-hover opacity-80" />
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {showLoading ? "—" : totalMonitors}
              </span>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Operational</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 opacity-80" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
                {showLoading ? "—" : upMonitors}
              </span>
              <span className="text-xs text-text-muted">
                {showLoading ? "" : `/ ${totalMonitors}`}
              </span>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Active Outages</span>
              <AlertCircle className="h-4 w-4 text-red-400 opacity-80" />
            </div>
            <div className="mt-2 flex items-baseline">
              <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${!showLoading && downMonitors > 0 ? "text-red-400" : "text-text-muted"}`}>
                {showLoading ? "—" : downMonitors}
              </span>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">24h Availability</span>
              <Globe className="h-4 w-4 text-text-accent opacity-80" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight">
                {showLoading ? "—" : avgUptime === "—" ? "100.00%" : `${avgUptime}%`}
              </span>
              {!showLoading && (
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${
                  downMonitors > 0
                    ? "text-red-400 bg-red-500/10 border-red-500/20"
                    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                }`}>
                  {downMonitors > 0 ? "Degraded" : "Operational"}
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Registered Endpoints Section */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Registered Endpoints {showLoading ? "" : `(${monitors.length})`}
            </h2>
            <span className="text-[11px] text-text-muted font-mono">
              Auto-refreshed via SSE
            </span>
          </div>

          {showLoading ? (
            <div className="rounded-2xl border border-border-default/60 bg-surface-base p-12 text-center text-xs sm:text-sm text-text-muted">
              Loading monitor telemetry stream...
            </div>
          ) : monitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default/70 bg-surface-base/50 p-12 text-center">
              <Activity className="mx-auto h-8 w-8 text-text-muted/60 mb-2" />
              <p className="text-sm font-medium text-text-secondary">No endpoints configured yet.</p>
              <p className="text-xs text-text-muted mt-1">Start probing your APIs, microservices, and databases in real time.</p>
              <Button onClick={() => setIsModalOpen(true)} variant="outline" className="mt-4">
                Register first endpoint
              </Button>
            </div>
          ) : (
            <div className="grid gap-3.5">
              {monitors.map((mon) => (
                <Card
                  key={mon.id}
                  className="p-5 hover:border-border-hover/70 hover:bg-surface-card/40 transition-all duration-200"
                >
                  <div className="flex flex-col space-y-4">
                    {/* Top Row: Info & Key Metrics */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2.5">
                          <Link
                            href={`/monitors/${mon.id}`}
                            className="font-semibold text-white hover:text-text-accent transition-colors flex items-center space-x-1.5 text-base"
                          >
                            <span>{mon.name}</span>
                            <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                          </Link>
                          <Badge
                            variant={
                              mon.status === "UP"
                                ? "success"
                                : mon.status === "DOWN"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            <span className="flex items-center space-x-1.5">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  mon.status === "UP"
                                    ? "bg-emerald-400"
                                    : mon.status === "DOWN"
                                    ? "bg-red-400"
                                    : "bg-zinc-400"
                                }`}
                              />
                              <span>{mon.status}</span>
                            </span>
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span className="font-mono bg-surface-card border border-border-subtle px-2 py-0.5 rounded text-[11px] font-semibold text-text-primary">
                            {mon.method}
                          </span>
                          <span className="truncate max-w-xs md:max-w-md font-mono text-text-secondary">
                            {mon.url}
                          </span>
                          <span>• every {mon.interval_seconds}s</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end space-x-6 sm:space-x-8">
                        <div className="text-right">
                          <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">24h Uptime</div>
                          <div className="text-sm font-bold text-white font-mono mt-0.5">
                            {(mon.total_checks ?? 0) > 0 && mon.uptime_24h !== null && mon.uptime_24h !== undefined
                              ? `${mon.uptime_24h}%`
                              : "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Avg Latency</div>
                          <div className="text-sm font-bold text-text-secondary font-mono mt-0.5">
                            {(mon.total_checks ?? 0) > 0 ? `${mon.avg_latency_24h ?? 0}ms` : "—"}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 pl-2 border-l border-border-subtle">
                          <button
                            onClick={() => togglePauseMutation.mutate({ id: mon.id, isActive: mon.is_active })}
                            className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-white transition-colors cursor-pointer"
                            title={mon.is_active ? "Pause monitor" : "Resume monitor"}
                          >
                            {mon.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete monitor "${mon.name}"?`)) {
                                deleteMutation.mutate(mon.id);
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete monitor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Better Stack Uptime Bar Segments */}
                    <div className="pt-2 border-t border-border-subtle/60">
                      <UptimeBar
                        checks={mon.recent_checks}
                        uptime={mon.uptime_24h}
                        totalChecks={mon.total_checks}
                        barCount={40}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Monitor Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Endpoint Monitor">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          {modalError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
              {modalError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Monitor Name</label>
            <Input placeholder="e.g. Auth Gateway" {...register("name")} />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1 space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Method</label>
              <select
                {...register("method")}
                className="flex h-9 w-full rounded-lg border border-border-default bg-canvas px-2 text-xs text-white focus-visible:outline-none focus-visible:border-brand-primary"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div className="col-span-3 space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Target URL</label>
              <Input placeholder="https://api.example.com/health" {...register("url")} />
              {errors.url && <p className="text-xs text-red-400">{errors.url.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Status Code</label>
              <Input type="number" {...register("expected_status", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Interval (sec)</label>
              <Input type="number" {...register("interval_seconds", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Timeout (ms)</label>
              <Input type="number" {...register("timeout_ms", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-border-subtle">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Configuring..." : "Start Probing"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
