"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pause, Play, Trash2, ArrowUpRight, Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest, getAccessToken } from "@/lib/api";
import { Monitor, MonitorFormData } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MonitorSchema } from "@/lib/schemas";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: monitors = [], isLoading } = useQuery<Monitor[]>({
    queryKey: ["monitors"],
    queryFn: () => apiRequest<Monitor[]>("/monitors"),
    enabled: typeof window !== "undefined" && !!getAccessToken(),
  });

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
  const avgUptime = totalMonitors > 0
    ? (monitors.reduce((acc, m) => acc + (m.uptime_24h ?? 100), 0) / totalMonitors).toFixed(2)
    : "100.00";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 py-8 flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Probing Engine</h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Real-time distributed health checks & telemetry streaming
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-1.5 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            <span>New Monitor</span>
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-zinc-400">Monitors</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold">{totalMonitors}</span>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-zinc-400">Operational</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-400">{upMonitors}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-zinc-400">Down / Outage</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-red-400">{downMonitors}</span>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-zinc-400">24h Uptime Avg</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold">{avgUptime}%</span>
              <span className="text-xs text-emerald-400">Normal</span>
            </div>
          </Card>
        </div>

        {/* Monitors Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Registered Endpoints</h2>

          {isLoading ? (
            <div className="p-12 text-center text-sm text-zinc-500">Loading monitor telemetry...</div>
          ) : monitors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center">
              <p className="text-sm text-zinc-400">No monitors configured yet.</p>
              <Button onClick={() => setIsModalOpen(true)} variant="outline" className="mt-4">
                Add your first endpoint
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {monitors.map((mon) => (
                <Card key={mon.id} className="p-4 transition-colors hover:border-zinc-700">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/monitors/${mon.id}`}
                          className="font-semibold text-zinc-100 hover:text-blue-400 transition-colors flex items-center space-x-1"
                        >
                          <span>{mon.name}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
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
                          {mon.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-zinc-400">
                        <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] text-zinc-300">
                          {mon.method}
                        </span>
                        <span className="truncate max-w-xs md:max-w-md font-mono">{mon.url}</span>
                        <span>• every {mon.interval_seconds}s</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end space-x-6">
                      <div className="text-right">
                        <div className="text-xs text-zinc-400">24h Uptime</div>
                        <div className="text-sm font-bold text-zinc-200">
                          {mon.uptime_24h ?? 100}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-400">Avg Latency</div>
                        <div className="text-sm font-bold text-zinc-200">
                          {mon.avg_latency_24h ?? 0}ms
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 pl-2">
                        <button
                          onClick={() => togglePauseMutation.mutate({ id: mon.id, isActive: mon.is_active })}
                          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title={mon.is_active ? "Pause" : "Resume"}
                        >
                          {mon.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete monitor "${mon.name}"?`)) {
                              deleteMutation.mutate(mon.id);
                            }
                          }}
                          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400">
              {modalError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Monitor Name</label>
            <Input placeholder="e.g. Auth Gateway" {...register("name")} />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1 space-y-1">
              <label className="text-xs font-medium text-zinc-300">Method</label>
              <select
                {...register("method")}
                className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div className="col-span-3 space-y-1">
              <label className="text-xs font-medium text-zinc-300">Target URL</label>
              <Input placeholder="https://api.example.com/health" {...register("url")} />
              {errors.url && <p className="text-xs text-red-400">{errors.url.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Status Code</label>
              <Input type="number" {...register("expected_status", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Interval (sec)</label>
              <Input type="number" {...register("interval_seconds", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Timeout (ms)</label>
              <Input type="number" {...register("timeout_ms", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Start Probing"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
