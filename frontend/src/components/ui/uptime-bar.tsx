import * as React from "react";
import { cn } from "@/lib/utils";

interface UptimeBarProps {
  uptime?: number;
  barCount?: number;
  className?: string;
  showLabels?: boolean;
}

export function UptimeBar({
  uptime = 100,
  barCount = 36,
  className,
  showLabels = true,
}: UptimeBarProps) {
  const bars = React.useMemo(() => {
    // Generate deterministic bar segments based on uptime percentage
    const hasOutage = uptime < 99.0;
    const hasDegraded = uptime < 99.9 && !hasOutage;

    return Array.from({ length: barCount }, (_, i) => {
      // simulate realistic status over the period
      if (hasOutage && (i === Math.floor(barCount * 0.65) || i === Math.floor(barCount * 0.68))) {
        return { status: "down", label: "Outage detected: 4m downtime" };
      }
      if (hasDegraded && i === Math.floor(barCount * 0.42)) {
        return { status: "degraded", label: "Degraded response: >1200ms" };
      }
      return { status: "up", label: "Operational: 100% uptime" };
    });
  }, [uptime, barCount]);

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
              bar.status === "down" && "bg-red-500/90 hover:bg-red-400 hover:scale-y-110"
            )}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex items-center justify-between text-[11px] font-medium text-text-muted">
          <span>90 days ago</span>
          <span className="font-mono text-emerald-400">{uptime.toFixed(2)}% uptime</span>
          <span>Today</span>
        </div>
      )}
    </div>
  );
}
