"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, X, Info } from "lucide-react";
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

interface BarSlot {
  index: number;
  status: "empty" | "up" | "down" | "degraded";
  label: string;
  check?: CheckResultSummary;
}

function getStatusText(code?: number | null, isUp?: boolean): string {
  if (!code) return isUp ? "HTTP 200 OK" : "Unreachable";
  const texts: Record<number, string> = {
    200: "HTTP 200 OK",
    201: "HTTP 201 Created",
    204: "HTTP 204 No Content",
    301: "HTTP 301 Moved Permanently",
    302: "HTTP 302 Found",
    304: "HTTP 304 Not Modified",
    400: "HTTP 400 Bad Request",
    401: "HTTP 401 Unauthorized",
    403: "HTTP 403 Forbidden",
    404: "HTTP 404 Not Found",
    408: "HTTP 408 Request Timeout",
    429: "HTTP 429 Too Many Requests",
    500: "HTTP 500 Internal Server Error",
    502: "HTTP 502 Bad Gateway",
    503: "HTTP 503 Service Unavailable",
    504: "HTTP 504 Gateway Timeout",
  };
  return texts[code] || `HTTP ${code}`;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0 || isNaN(diffMs)) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function UptimeBar({
  checks = [],
  uptime,
  totalChecks,
  barCount = 40,
  className,
  showLabels = true,
}: UptimeBarProps) {
  const [selectedSlotIndex, setSelectedSlotIndex] = React.useState<number | null>(null);

  const bars: BarSlot[] = React.useMemo(() => {
    if (checks && checks.length > 0) {
      const recent = checks.slice(-barCount);
      const emptyCount = Math.max(0, barCount - recent.length);

      const slots: BarSlot[] = [];

      // Empty historical slots before checks began
      for (let i = 0; i < emptyCount; i++) {
        slots.push({
          index: i,
          status: "empty",
          label: "No check recorded in this window",
        });
      }

      // Real check slots
      for (let i = 0; i < recent.length; i++) {
        const check = recent[i];
        let status: "up" | "down" | "degraded" = "up";
        if (!check.is_up) {
          status = "down";
        } else if (check.latency_ms >= 1000) {
          status = "degraded";
        }

        const formattedTime = new Date(check.checked_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const label = check.is_up
          ? `HTTP ${check.status_code ?? 200} • ${check.latency_ms}ms • ${formattedTime} (Click to inspect)`
          : `${check.error_message || "Probe failed"} (HTTP ${check.status_code ?? "—"}) • ${check.latency_ms}ms • ${formattedTime} (Click to inspect)`;

        slots.push({
          index: emptyCount + i,
          status,
          label,
          check,
        });
      }

      return slots;
    }

    // When no checks have run yet
    return Array.from({ length: barCount }, (_, i) => ({
      index: i,
      status: "empty" as const,
      label: "Awaiting initial probe",
    }));
  }, [checks, barCount]);

  const hasChecks = (totalChecks ?? checks.length) > 0;
  const displayUptime = uptime !== null && uptime !== undefined ? `${uptime.toFixed(2)}%` : "—";
  const selectedSlot = selectedSlotIndex !== null ? bars[selectedSlotIndex] : null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Bars Row */}
      <div
        role="group"
        aria-label="Uptime check history"
        className="flex items-center gap-[3px] h-6 w-full py-0.5"
      >
        {bars.map((bar, idx) => {
          const isSelected = selectedSlotIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              role="button"
              tabIndex={0}
              title={bar.label}
              aria-label={bar.label}
              aria-pressed={isSelected}
              onClick={() => setSelectedSlotIndex(isSelected ? null : idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedSlotIndex(isSelected ? null : idx);
                }
              }}
              className={cn(
                "h-full flex-1 rounded-[2px] transition-all duration-150 cursor-pointer focus:outline-none",
                bar.status === "up" && "bg-emerald-500/80 hover:bg-emerald-400 hover:scale-y-110",
                bar.status === "degraded" && "bg-amber-500/90 hover:bg-amber-400 hover:scale-y-110",
                bar.status === "down" && "bg-red-500/90 hover:bg-red-400 hover:scale-y-110",
                bar.status === "empty" && "bg-surface-elevated/40 hover:bg-surface-elevated/70",
                isSelected && "ring-2 ring-white scale-y-125 z-10 brightness-125 shadow-lg"
              )}
            />
          );
        })}
      </div>

      {/* Labels & Mini Legend Row */}
      {showLabels && (
        <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-[11px] font-medium text-text-muted">
          <div className="flex items-center gap-1.5">
            <span>{hasChecks ? "Recent checks" : "Awaiting initial probe"}</span>
            <span className="text-text-muted/40">•</span>
            <span className="text-[10px] text-text-muted/70 hidden sm:inline">
              click any box to inspect
            </span>
          </div>

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

          {/* Inline Color Legend */}
          <div className="flex items-center gap-2.5 text-[10px] font-mono">
            <span
              className="inline-flex items-center gap-1 text-text-secondary cursor-help"
              title="Operational: Probe succeeded with latency < 1000ms"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              &lt;1s
            </span>
            <span
              className="inline-flex items-center gap-1 text-text-secondary cursor-help"
              title="Degraded: Probe succeeded but latency was slow (≥ 1000ms)"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              ≥1s
            </span>
            <span
              className="inline-flex items-center gap-1 text-text-secondary cursor-help"
              title="Down: Probe failed, unexpected HTTP status code, or network timeout"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Down
            </span>
            <span className="text-text-muted/60 pl-1 border-l border-border-subtle/60">Now</span>
          </div>
        </div>
      )}

      {/* Detail Inspection Card on Click */}
      {selectedSlot && (
        <div className="relative mt-2 p-3 sm:p-3.5 rounded-xl border border-border-default/90 bg-surface-base/95 shadow-2xl backdrop-blur-md text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border-subtle/70">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSlot.status === "up" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3" />
                  Operational (&lt;1s)
                </span>
              )}
              {selectedSlot.status === "degraded" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="h-3 w-3" />
                  Degraded Latency (≥1s)
                </span>
              )}
              {selectedSlot.status === "down" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-red-500/15 text-red-400 border border-red-500/30">
                  <AlertCircle className="h-3 w-3" />
                  Probe Failed / Outage
                </span>
              )}
              {selectedSlot.status === "empty" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-surface-elevated text-text-muted border border-border-default">
                  <Info className="h-3 w-3" />
                  No Check Recorded
                </span>
              )}
              <span className="text-[11px] text-text-muted font-mono">
                Probe #{selectedSlot.index + 1} of {barCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedSlot.check && (
                <span className="text-[11px] text-text-muted font-mono flex items-center gap-1">
                  <Clock className="h-3 w-3 text-text-muted/70" />
                  {formatRelativeTime(selectedSlot.check.checked_at)}
                  <span className="hidden sm:inline text-text-muted/50">
                    ({new Date(selectedSlot.check.checked_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })})
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedSlotIndex(null)}
                aria-label="Close probe details"
                className="text-text-muted hover:text-white p-1 rounded-md hover:bg-surface-elevated transition-colors ml-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {selectedSlot.check ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-surface-card border border-border-subtle/60">
                  <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider block">
                    Response
                  </span>
                  <span
                    className={cn(
                      "font-mono font-bold text-xs sm:text-sm mt-0.5 block truncate",
                      selectedSlot.check.is_up ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {getStatusText(selectedSlot.check.status_code, selectedSlot.check.is_up)}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-surface-card border border-border-subtle/60">
                  <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider block">
                    Total Latency
                  </span>
                  <span
                    className={cn(
                      "font-mono font-bold text-xs sm:text-sm mt-0.5 block",
                      !selectedSlot.check.is_up
                        ? "text-red-400"
                        : selectedSlot.check.latency_ms < 1000
                        ? "text-emerald-400"
                        : "text-amber-400"
                    )}
                  >
                    {selectedSlot.check.latency_ms} ms
                  </span>
                </div>

                <div
                  className="p-2 rounded-lg bg-surface-card border border-border-subtle/60"
                  title="DNS: Domain name resolution time • TLS: SSL/TLS handshake negotiation time"
                >
                  <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider block">
                    DNS / TLS Handshake
                  </span>
                  <span className="font-mono font-semibold text-xs text-text-secondary mt-0.5 block">
                    {selectedSlot.check.dns_ms !== undefined && selectedSlot.check.dns_ms !== null
                      ? `${selectedSlot.check.dns_ms === 0 ? "<1" : selectedSlot.check.dns_ms}ms`
                      : "—"}
                    {" / "}
                    {selectedSlot.check.tls_ms !== undefined && selectedSlot.check.tls_ms !== null
                      ? `${selectedSlot.check.tls_ms === 0 ? "<1" : selectedSlot.check.tls_ms}ms`
                      : "—"}
                  </span>
                </div>

                <div
                  className="p-2 rounded-lg bg-surface-card border border-border-subtle/60"
                  title="Time To First Byte: Server processing time until response headers/first byte arrive"
                >
                  <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider block">
                    TTFB (First Byte)
                  </span>
                  <span className="font-mono font-semibold text-xs text-text-secondary mt-0.5 block">
                    {selectedSlot.check.ttfb_ms !== undefined && selectedSlot.check.ttfb_ms !== null
                      ? `${selectedSlot.check.ttfb_ms === 0 ? "<1" : selectedSlot.check.ttfb_ms} ms`
                      : "—"}
                  </span>
                </div>
              </div>

              {selectedSlot.check.error_message && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-red-200">Probe Failure Diagnostic:</span>
                    <span>{selectedSlot.check.error_message}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-text-muted pt-1 px-0.5 border-t border-border-subtle/40 font-mono">
                <span>Timestamp: {new Date(selectedSlot.check.checked_at).toISOString()}</span>
                <span>Click any other box to inspect or &apos;X&apos; to close</span>
              </div>
            </div>
          ) : (
            <div className="py-2.5 text-center text-text-muted text-xs">
              <p>No probe execution was recorded in this slot window.</p>
              <p className="text-[11px] text-text-muted/70 mt-1">
                The monitor was awaiting its scheduled interval or was created recently.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
