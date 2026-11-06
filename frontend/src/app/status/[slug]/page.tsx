import { CheckCircle2, AlertTriangle, AlertCircle, Shield } from "lucide-react";
import { Monitor } from "@/lib/schemas";

async function getStatusSummary(): Promise<{
  system_status: string;
  total_monitors: number;
  monitors_up: number;
  monitors_down: number;
  monitors: Monitor[];
}> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
  try {
    const res = await fetch(`${apiBase}/public/status`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        system_status: "OPERATIONAL",
        total_monitors: 0,
        monitors_up: 0,
        monitors_down: 0,
        monitors: [],
      };
    }
    return res.json();
  } catch {
    return {
      system_status: "OPERATIONAL",
      total_monitors: 0,
      monitors_up: 0,
      monitors_down: 0,
      monitors: [],
    };
  }
}

export default async function PublicStatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getStatusSummary();

  const isAllOperational = data.system_status === "OPERATIONAL" && data.monitors_down === 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center">
      <div className="w-full max-w-4xl px-4 py-12 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-sm">
              PG
            </div>
            <div>
              <h1 className="text-xl font-bold capitalize">{slug} Status</h1>
              <p className="text-xs text-zinc-400">Live operational telemetry & uptime</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 text-xs text-zinc-500">
            <Shield className="h-4 w-4" />
            <span>PulseGrid Engine</span>
          </div>
        </div>

        {/* System Banner */}
        <div
          className={`rounded-2xl border p-6 flex items-center space-x-4 ${
            isAllOperational
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : data.monitors_down > 0 && data.monitors_up > 0
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {isAllOperational ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-400 shrink-0" />
          ) : data.monitors_down > 0 && data.monitors_up > 0 ? (
            <AlertTriangle className="h-8 w-8 text-amber-400 shrink-0" />
          ) : (
            <AlertCircle className="h-8 w-8 text-red-400 shrink-0" />
          )}
          <div>
            <h2 className="text-lg font-bold">
              {isAllOperational
                ? "All Systems Fully Operational"
                : data.monitors_down > 0 && data.monitors_up > 0
                ? "Partial System Degradation"
                : "Major System Outage"}
            </h2>
            <p className="text-xs opacity-80 mt-0.5">
              {data.monitors_up} of {data.total_monitors} active endpoints responding normally.
            </p>
          </div>
        </div>

        {/* Services / Monitors List */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            System Components
          </h3>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800">
            {data.monitors.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                No public monitors registered yet.
              </div>
            ) : (
              data.monitors.map((mon) => (
                <div key={mon.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-zinc-200">{mon.name}</span>
                    <span className="text-xs text-zinc-500 block font-mono">
                      24h Uptime: {mon.uptime_24h ?? 100}%
                    </span>
                  </div>

                  <div>
                    {mon.status === "UP" ? (
                      <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>Operational</span>
                      </span>
                    ) : mon.status === "DOWN" ? (
                      <span className="flex items-center space-x-1.5 text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        <span>Outage</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1.5 text-xs text-zinc-400 font-medium bg-zinc-800 px-2.5 py-1 rounded-full">
                        <span>{mon.status}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-600 pt-8">
          Powered by PulseGrid Distributed Probing Engine
        </div>
      </div>
    </div>
  );
}
