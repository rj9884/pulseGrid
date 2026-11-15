"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pause,
  Play,
  Trash2,
  ArrowUpRight,
  Activity,
  AlertCircle,
  CheckCircle2,
  Globe,
  Radio,
  Server,
  Terminal,
  Zap,
  ArrowRight,
  Shield,
  Clock,
  Cpu,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Monitor, MonitorFormData, MonitorSchema } from "@/lib/schemas";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { UptimeBar } from "@/components/ui/uptime-bar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const emptySubscribe = () => () => {};

interface PublicStatusData {
  system_status: string;
  total_monitors: number;
  monitors_up: number;
  monitors_down: number;
  monitors: Monitor[];
}

interface HomePageContentProps {
  initialPublicStatus: PublicStatusData;
}

export function HomePageContent({ initialPublicStatus }: HomePageContentProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const { isAuthenticated, token } = useAuth();

  if (!mounted) {
    return (
      <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-xs sm:text-sm text-text-muted">
          Initialising prober workspace...
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    <AuthenticatedDashboard token={token} />
  ) : (
    <PublicHomeOverview initialData={initialPublicStatus} />
  );
}

// ==========================================
// 1. Authenticated Telemetry & Uptime Monitor
// ==========================================
function AuthenticatedDashboard({ token }: { token: string | null }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: monitors = [], isLoading } = useQuery<Monitor[]>({
    queryKey: ["monitors"],
    queryFn: () => apiRequest<Monitor[]>("/monitors"),
    enabled: typeof window !== "undefined" && !!token,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MonitorFormData>({
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
  const avgUptime =
    monitorsWithData.length > 0
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
                {isLoading ? "—" : totalMonitors}
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
                {isLoading ? "—" : upMonitors}
              </span>
              <span className="text-xs text-text-muted">
                {isLoading ? "" : `/ ${totalMonitors}`}
              </span>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Active Outages</span>
              <AlertCircle className="h-4 w-4 text-red-400 opacity-80" />
            </div>
            <div className="mt-2 flex items-baseline">
              <span
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                  !isLoading && downMonitors > 0 ? "text-red-400" : "text-text-muted"
                }`}
              >
                {isLoading ? "—" : downMonitors}
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
                {isLoading ? "—" : avgUptime === "—" ? "100.00%" : `${avgUptime}%`}
              </span>
              {!isLoading && (
                <span
                  className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${
                    downMonitors > 0
                      ? "text-red-400 bg-red-500/10 border-red-500/20"
                      : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  }`}
                >
                  {downMonitors > 0 ? "Degraded" : "Operational"}
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Registered Endpoints Section */}
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Registered Endpoints {isLoading ? "" : `(${monitors.length})`}
              </h2>
              <span className="text-[11px] text-text-muted font-mono">
                Auto-refreshed via SSE
              </span>
            </div>

            {/* Visual Color Status Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] bg-surface-card/60 px-3 py-1.5 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] uppercase font-semibold text-text-muted mr-0.5">Legend:</span>
              <span className="inline-flex items-center gap-1.5 text-text-secondary" title="Responding normally with latency under 1000ms">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                Operational {"(<1s)"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-text-secondary" title="Responding slow with latency 1000ms or higher">
                <span className="h-2 w-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
                Degraded (≥1s)
              </span>
              <span className="inline-flex items-center gap-1.5 text-text-secondary" title="Check failed, unexpected HTTP status code, or network outage">
                <span className="h-2 w-2 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
                Outage / Down
              </span>
              <span className="inline-flex items-center gap-1.5 text-text-secondary" title="No check recorded in that historical time slot">
                <span className="h-2 w-2 rounded-full bg-surface-elevated border border-border-default"></span>
                No Data
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-border-default/60 bg-surface-base p-12 text-center text-xs sm:text-sm text-text-muted">
              Loading monitor telemetry stream...
            </div>
          ) : monitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default/70 bg-surface-base/50 p-12 text-center">
              <Activity className="mx-auto h-8 w-8 text-text-muted/60 mb-2" />
              <p className="text-sm font-medium text-text-secondary">No endpoints configured yet.</p>
              <p className="text-xs text-text-muted mt-1">
                Start probing your APIs, microservices, and databases in real time.
              </p>
              <Button onClick={() => setIsModalOpen(true)} variant="outline" className="mt-4 cursor-pointer">
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
                          <Badge variant={mon.status === "UP" ? "success" : "destructive"}>
                            {mon.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-text-muted font-mono">
                          <span className="font-semibold uppercase tracking-wider text-text-secondary bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle">
                            {mon.method}
                          </span>
                          <span className="truncate max-w-xs sm:max-w-md">{mon.url}</span>
                          <span>• every {mon.interval_seconds}s</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 sm:space-x-6 self-start md:self-auto">
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">
                            24h Uptime
                          </div>
                          <div className="text-base font-bold text-white font-mono">
                            {mon.uptime_24h !== null && mon.uptime_24h !== undefined
                              ? `${mon.uptime_24h.toFixed(2)}%`
                              : "100.00%"}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">
                            Avg Latency
                          </div>
                          <div className="text-base font-bold text-white font-mono">
                            {mon.avg_latency_24h ? `${mon.avg_latency_24h}ms` : "—"}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-1 border-l border-border-subtle pl-4">
                          <button
                            onClick={() => togglePauseMutation.mutate({ id: mon.id, isActive: mon.is_active })}
                            className="p-1.5 text-text-muted hover:text-white rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
                            title={mon.is_active ? "Pause Prober" : "Resume Prober"}
                          >
                            {mon.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete monitor "${mon.name}"?`)) {
                                deleteMutation.mutate(mon.id);
                              }
                            }}
                            className="p-1.5 text-text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete Monitor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Uptime tick bars */}
                    <div className="pt-1">
                      <UptimeBar
                        checks={mon.recent_checks}
                        uptime={mon.uptime_24h}
                        totalChecks={mon.total_checks}
                        barCount={36}
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Endpoint">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          {modalError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
              {modalError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Monitor Name</label>
            <Input placeholder="Core API Gateway" {...register("name")} />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Target Endpoint URL</label>
            <Input placeholder="https://api.yourdomain.com/health" {...register("url")} />
            {errors.url && <p className="text-xs text-red-400">{errors.url.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">HTTP Method</label>
              <select
                {...register("method")}
                className="flex h-9 w-full rounded-lg border border-border-default bg-canvas px-3 py-1 text-xs sm:text-sm text-text-primary shadow-inner focus-visible:outline-none focus-visible:border-brand-primary"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Expected Status</label>
              <Input type="number" {...register("expected_status", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Interval (seconds)</label>
              <Input type="number" {...register("interval_seconds", { valueAsNumber: true })} />
              {errors.interval_seconds && (
                <p className="text-xs text-red-400">{errors.interval_seconds.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Timeout (ms)</label>
              <Input type="number" {...register("timeout_ms", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {createMutation.isPending ? "Configuring..." : "Deploy Monitor"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ==========================================
// 2. Default Home / Public Telemetry Overview
// ==========================================
function PublicHomeOverview({ initialData }: { initialData: PublicStatusData }) {
  const { data: publicStatus, isLoading, isError } = useQuery<PublicStatusData>({
    queryKey: ["public-status"],
    queryFn: () => apiRequest<PublicStatusData>("/public/status"),
    initialData,
  });

  const isAllOperational =
    publicStatus?.system_status === "OPERATIONAL" && (publicStatus?.monitors_down ?? 0) === 0;

  return (
    <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14 flex-1 space-y-12">
        {/* Hero Section */}
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex items-center space-x-2 rounded-full border border-border-default/80 bg-surface-card/60 px-3 py-1 text-xs text-text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] text-text-secondary">Distributed Uptime Engine &bull; Go 1.23 Prober</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Precision API Uptime & Latency Telemetry
          </h1>

          <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-2xl">
            Distributed health-checking engine with microsecond roundtrip decomposition across DNS lookup,
            TLS handshake, and Time To First Byte (TTFB). Real-time incident streaming over Server-Sent Events.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/register"
              className="inline-flex items-center space-x-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-brand-hover shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35)] transition-all"
            >
              <span>Deploy First Monitor</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center space-x-2 rounded-xl border border-border-default bg-surface-card/60 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:border-border-hover hover:bg-surface-card transition-all"
            >
              <Terminal className="h-4 w-4 text-text-muted" />
              <span>Sign In to Console</span>
            </Link>

            <Link
              href="/status/global"
              className="inline-flex items-center space-x-2 rounded-xl border border-border-subtle bg-surface-base px-3.5 py-2.5 text-xs sm:text-sm font-medium text-text-muted hover:text-white transition-all"
            >
              <Radio className="h-4 w-4 text-text-accent" />
              <span>Live Public Status</span>
            </Link>
          </div>
        </div>

        {/* Live Public Telemetry Stream Preview */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div className="flex items-center space-x-2.5">
              <Server className="h-4 w-4 text-text-accent" />
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Live Public Infrastructure Telemetry
              </h2>
            </div>
            <div className="flex items-center space-x-3 text-xs text-text-muted">
              <span className="flex items-center space-x-1.5 font-mono text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                <span>Direct probe feed</span>
              </span>
              <Link href="/status/global" className="text-text-accent hover:underline text-xs flex items-center space-x-1">
                <span>View Full Status Page</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* System Status Banner */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 flex items-center justify-between shadow-xs ${
              isAllOperational
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : (publicStatus?.monitors_down ?? 0) > 0 && (publicStatus?.monitors_up ?? 0) > 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            <div className="flex items-center space-x-3">
              {isAllOperational ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              ) : (publicStatus?.monitors_down ?? 0) > 0 && (publicStatus?.monitors_up ?? 0) > 0 ? (
                <AlertCircle className="h-6 w-6 text-amber-400 shrink-0" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-400 shrink-0" />
              )}
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {isAllOperational
                    ? "All Systems Operational"
                    : (publicStatus?.monitors_down ?? 0) > 0 && (publicStatus?.monitors_up ?? 0) > 0
                    ? "Partial Infrastructure Degradation"
                    : "Active Incident Detected"}
                </h3>
                <p className="text-xs opacity-85 mt-0.5">
                  {publicStatus?.monitors_up ?? 0} of {publicStatus?.total_monitors ?? 0} public services responding within SLA.
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[10px] uppercase font-semibold text-text-muted">Prober Cadence</span>
              <p className="text-xs font-mono font-medium text-white">60s automated ticks</p>
            </div>
          </div>

          {/* Color Status Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-text-muted">
            <span className="text-xs font-medium text-text-secondary">
              Publicly Monitored Services ({publicStatus?.monitors?.length ?? 0})
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                {"<1s"} Operational
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                ≥1s Degraded
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                Outage / Down
              </span>
              <span className="text-text-muted/60 pl-1 border-l border-border-subtle/60">Now</span>
            </div>
          </div>

          {/* Public Services List */}
          {isLoading && !isError ? (
            <div className="rounded-2xl border border-border-default/60 bg-surface-base p-8 text-center text-xs text-text-muted">
              Loading public prober telemetry...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center text-xs text-red-400">
              Failed to load public telemetry. <Link href="/" className="underline ml-1">Retry</Link>
            </div>
          ) : !publicStatus?.monitors || publicStatus.monitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default/70 bg-surface-base/50 p-8 text-center">
              <Server className="mx-auto h-7 w-7 text-text-muted/60 mb-2" />
              <p className="text-xs sm:text-sm font-medium text-text-secondary">No public services published yet.</p>
              <Link href="/login" className="text-xs text-text-accent hover:underline mt-2 inline-block">
                Sign in to register your first endpoint →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3.5">
              {publicStatus.monitors.map((mon) => (
                <Card key={mon.id} className="p-4 sm:p-5 hover:border-border-hover/70 transition-colors">
                  <div className="flex flex-col space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white text-sm sm:text-base">{mon.name}</span>
                          <Badge variant={mon.status === "UP" ? "success" : "destructive"}>
                            {mon.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-text-muted font-mono">
                          <span className="font-semibold uppercase tracking-wider text-text-secondary bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle">
                            {mon.method}
                          </span>
                          <span className="truncate max-w-xs sm:max-w-md">{mon.url}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 self-start sm:self-auto text-right">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-text-muted">24h Uptime</div>
                          <div className="text-sm sm:text-base font-bold text-white font-mono">
                            {mon.uptime_24h !== null && mon.uptime_24h !== undefined
                              ? `${mon.uptime_24h.toFixed(2)}%`
                              : "100.00%"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-text-muted">Avg Latency</div>
                          <div className="text-sm sm:text-base font-bold text-white font-mono">
                            {mon.avg_latency_24h ? `${mon.avg_latency_24h}ms` : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1">
                      <UptimeBar
                        checks={mon.recent_checks}
                        uptime={mon.uptime_24h}
                        totalChecks={mon.total_checks}
                        barCount={36}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Technical Architecture Specs (Non-AI Slop) */}
        <div className="space-y-4 pt-4 border-t border-border-subtle/60">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
              Prober Engine Specifications & Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Engineered for low-latency network diagnosis and transparent edge probe execution
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center space-x-2 text-brand-hover">
                <Cpu className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Go 1.23 Goroutine Workers</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Non-blocking concurrent probe pool with isolated HTTP transports, preventing connection head-of-line blocking.
              </p>
            </Card>

            <Card className="p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Sub-ms Timing Breakdown</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Granular roundtrip decomposition exposing DNS lookup, TCP dial, TLS handshake, and First Byte (TTFB).
              </p>
            </Card>

            <Card className="p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center space-x-2 text-text-accent">
                <Zap className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Zero-Polling SSE Stream</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Probe results pushed directly to browser clients over Server-Sent Events with automatic channel reconnects.
              </p>
            </Card>

            <Card className="p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center space-x-2 text-amber-400">
                <Shield className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Flapping Suppression</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Consecutive failure assertions prevent alert noise from transient network hiccups before dispatching webhooks.
              </p>
            </Card>
          </div>
        </div>

        {/* Action Callout */}
        <div className="rounded-2xl border border-border-default/80 bg-surface-card/40 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white tracking-tight">Ready to monitor your services?</h3>
            <p className="text-xs sm:text-sm text-text-muted">
              Configure endpoints, define latency SLAs, and stream real-time incidents to your team.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/register"
              className="inline-flex items-center space-x-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-brand-hover shadow-xs transition-colors"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 rounded-lg border border-border-default bg-surface-base px-3.5 py-2 text-xs sm:text-sm font-medium text-text-muted hover:text-white transition-colors"
            >
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border-subtle/50 py-6 text-center text-xs text-text-muted/60">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl">
          <span>PulseGrid Distributed Prober &bull; Millisecond Telemetry</span>
          <div className="flex items-center space-x-4">
            <Link href="/status/global" className="hover:text-text-secondary transition-colors">
              Public Status
            </Link>
            <Link href="/login" className="hover:text-text-secondary transition-colors">
              Console Sign In
            </Link>
            <Link href="/register" className="hover:text-text-secondary transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}