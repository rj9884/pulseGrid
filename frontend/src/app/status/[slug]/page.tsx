import { CheckCircle2, AlertTriangle, AlertCircle, Shield, Zap } from "lucide-react";
import { Monitor } from "@/lib/schemas";
import { UptimeBar } from "@/components/ui/uptime-bar";

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
    <div className="min-h-screen bg-canvas text-text-secondary flex flex-col items-center">
      <div className="w-full max-w-4xl px-4 sm:px-6 py-12 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-6">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35)]">
              <Zap className="h-5 w-5 fill-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white capitalize tracking-tight">{slug} Status</h1>
              <p className="text-xs text-text-muted mt-0.5">Real-time infrastructure health and operational metrics</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-text-muted bg-surface-card/50 border border-border-subtle px-2.5 py-1 rounded-full">
            <Shield className="h-3.5 w-3.5 text-text-accent" />
            <span>Verified Status</span>
          </div>
        </div>

        {/* System Banner */}
        <div
          className={`rounded-2xl border p-6 flex items-center space-x-4 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.6)] ${
            isAllOperational
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : data.monitors_down > 0 && data.monitors_up > 0
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {isAllOperational ? (
            <CheckCircle2 className="h-9 w-9 text-emerald-400 shrink-0" />
          ) : data.monitors_down > 0 && data.monitors_up > 0 ? (
            <AlertTriangle className="h-9 w-9 text-amber-400 shrink-0" />
          ) : (
            <AlertCircle className="h-9 w-9 text-red-400 shrink-0" />
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              {isAllOperational
                ? "All Systems Operational"
                : data.monitors_down > 0 && data.monitors_up > 0
                ? "Partial System Degradation"
                : "Active Major Outage"}
            </h2>
            <p className="text-xs sm:text-sm opacity-90 mt-0.5">
              {data.monitors_up} of {data.total_monitors} monitored endpoints reporting nominal response latencies.
            </p>
          </div>
        </div>

        {/* Services / Monitors List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              System Components & Availability
            </h3>
            <span className="text-[11px] font-mono text-text-muted">Updated in real-time</span>
          </div>

          <div className="rounded-2xl border border-border-default/70 bg-surface-base divide-y divide-border-subtle/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.6)]">
            {data.monitors.length === 0 ? (
              <div className="p-8 text-center text-xs sm:text-sm text-text-muted">
                No public monitors configured for this status page.
              </div>
            ) : (
              data.monitors.map((mon) => (
                <div key={mon.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white text-sm sm:text-base">{mon.name}</span>
                      <span className="text-xs text-text-muted block font-mono">
                        {mon.url}
                      </span>
                    </div>

                    <div>
                      {mon.status === "UP" ? (
                        <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>Operational</span>
                        </span>
                      ) : mon.status === "DOWN" ? (
                        <span className="inline-flex items-center space-x-1.5 text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          <span>Outage</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 text-xs text-text-muted font-medium bg-surface-card px-2.5 py-1 rounded-full border border-border-subtle">
                          <span>{mon.status}</span>
                        </span>
                      )}
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
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-text-muted/60 pt-8 border-t border-border-subtle/40">
          Powered by PulseGrid Distributed Telemetry & Probing Engine
        </div>
      </div>
    </div>
  );
}
