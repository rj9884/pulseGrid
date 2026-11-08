import * as React from "react";
import { cn } from "@/lib/utils";
import type { CheckResultSummary } from "@/lib/schemas";

interface UptimeBarProps {
  checks?: CheckResultSummary[];
  uptime?: number | null;
  totalChecks?: number;
  barCount?: number;
  className?: string;
  showLabels?: boolean;
}

export function UptimeBar({
  checks = [],
  uptime,
  totalChecks,
  barCount = 40,
  className,
  showLabels = true,
}: UptimeBarProps) {
  const bars = React.useMemo(() => {
    // If checks are provided, render the actual check timeline (chronological order)
    if (checks && checks.length > 0) {
      const recent = checks.slice(-barCount);
      const emptyCount = Math.max(0, barCount - recent.length);

      const slots: Array<{
        status: "empty" | "up" | "down" | "degraded";
        label: string;
      }> = [];

      // Empty historical slots before checks began
      for (let i = 0; i < emptyCount; i++) {
        slots.push({
          status: "empty",
          label: "No check recorded in this window",
        });
      }

      // Real check slots
      for (const check of recent) {
        let status: "up" | "down" | "degraded" = "up";
        if (!check.is_up) {
          status = "down";
        } else if (check.latency_ms > 1000) {
          status = "degraded";
        }

        const formattedTime = new Date(check.checked_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const label = check.is_up
          ? `HTTP ${check.status_code ?? 200} • ${check.latency_ms}ms • ${formattedTime}`
          : `${check.error_message || "Probe failed"} (HTTP ${check.status_code ?? "—"}) • ${check.latency_ms}ms • ${formattedTime}`;

        slots.push({
          status,
          label,
        });
      }

      return slots;
    }

    // When no checks have run yet
    return Array.from({ length: barCount }, () => ({
      status: "empty" as const,
      label: "Awaiting initial probe",
    }));
  }, [checks, barCount]);

  const hasChecks = (totalChecks ?? checks.length) > 0;
  const displayUptime = uptime !== null && uptime !== undefined ? `${uptime.toFixed(2)}%` : "—";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-[3px] h-6 w-full">
        {bars.map((bar, idx) => (
          <div
            key={idx}
            title={bar.label}
            className={cn(
              "h-full flex-1 rounded-[2px] transition-all duration-150 cursor-pointer",
              bar.status === "up" && "bg-emerald-500/80 hover:bg-emerald-400 hover:scale-y-110",
              bar.status === "degraded" && "bg-amber-500/90 hover:bg-amber-400 hover:scale-y-110",
              bar.status === "down" && "bg-red-500/90 hover:bg-red-400 hover:scale-y-110",
              bar.status === "empty" && "bg-surface-elevated/40 hover:bg-surface-elevated/70"
            )}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex items-center justify-between text-[11px] font-medium text-text-muted">
          <span>{hasChecks ? "Recent checks" : "Awaiting initial probe"}</span>
          <span
            className={cn(
              "font-mono font-semibold",
              hasChecks && (uptime ?? 0) >= 99 && "text-emerald-400",
              hasChecks && (uptime ?? 0) < 99 && (uptime ?? 0) > 0 && "text-amber-400",
              hasChecks && (uptime ?? 0) === 0 && "text-red-400",
              !hasChecks && "text-text-muted font-normal"
            )}
          >
            {hasChecks ? `${displayUptime} uptime (${totalChecks ?? checks.length} checks)` : "No check data"}
          </span>
          <span>Now</span>
        </div>
      )}
    </div>
  );
}
