"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckEventSchema, type CheckEvent, type Monitor } from "@/lib/schemas";
import { useAuth } from "@/hooks/use-auth";

const SSE_URL = "/api/v1/stream/events";

interface CheckItemRecord {
  id: number;
  monitor_id: string;
  status_code?: number | null;
  latency_ms: number;
  dns_ms: number;
  connect_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  is_up: boolean;
  error_message?: string | null;
  checked_at: string;
}

export function useEventStream() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<CheckEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!token) return;
    if (eventSourceRef.current) return; // Already connected

    const url = new URL(SSE_URL);
    url.searchParams.set("token", token);

    const es = new EventSource(url.toString(), { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      setIsConnected(true);
    });

    es.addEventListener("check_completed", (event: MessageEvent) => {
      try {
        const raw = JSON.parse(event.data);
        const parsed = CheckEventSchema.parse(raw);
        setLastEvent(parsed);

        // 1. Optimistically update monitor cache in TanStack Query
        queryClient.setQueryData<Monitor[]>(["monitors"], (old) => {
          if (!old) return old;
          return old.map((m) => {
            if (m.id === parsed.monitor_id) {
              const newCheck = {
                status_code: parsed.status_code,
                latency_ms: parsed.latency_ms,
                dns_ms: parsed.dns_ms,
                connect_ms: parsed.connect_ms,
                tls_ms: parsed.tls_ms,
                ttfb_ms: parsed.ttfb_ms,
                is_up: parsed.is_up,
                error_message: parsed.error_message,
                checked_at: parsed.checked_at,
              };
              const updatedRecentChecks = [...(m.recent_checks || []), newCheck].slice(-40);
              const totalChecks = (m.total_checks || 0) + 1;
              const upCount = updatedRecentChecks.filter((c) => c.is_up).length;
              const calculatedUptime = Number(((upCount / updatedRecentChecks.length) * 100).toFixed(2));

              return {
                ...m,
                status: parsed.status,
                last_checked_at: parsed.checked_at,
                uptime_24h: calculatedUptime,
                total_checks: totalChecks,
                recent_checks: updatedRecentChecks,
                avg_latency_24h: parsed.latency_ms,
              };
            }
            return m;
          });
        });

        // 2. Prepend to monitor checks cache if loaded
        queryClient.setQueryData<CheckItemRecord[]>(["monitor-checks", parsed.monitor_id], (old) => {
          if (!old) return old;
          return [
            {
              id: Date.now(),
              monitor_id: parsed.monitor_id,
              status_code: parsed.status_code,
              latency_ms: parsed.latency_ms,
              dns_ms: parsed.dns_ms,
              connect_ms: parsed.connect_ms,
              tls_ms: parsed.tls_ms,
              ttfb_ms: parsed.ttfb_ms,
              is_up: parsed.is_up,
              error_message: parsed.error_message,
              checked_at: parsed.checked_at,
            },
            ...old.slice(0, 49),
          ];
        });

        // 3. Invalidate on state transitions (UP -> DOWN or DOWN -> UP)
        if (parsed.status_changed) {
          queryClient.invalidateQueries({ queryKey: ["monitors"] });
          queryClient.invalidateQueries({ queryKey: ["incidents"] });
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      // EventSource automatically reconnects - we just track connection state
      // If the connection is permanently lost, the browser will eventually stop retrying
      // We can optionally schedule a manual reconnect after a long delay as fallback
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.CLOSED) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            reconnectTimeoutRef.current = null;
            connect(); // Reconnect
          } else {
            reconnectTimeoutRef.current = null;
          }
        }, 30000); // 30s fallback - EventSource native reconnection should handle most cases
      }
    };
  }, [queryClient, token]);

  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsConnected(false);
    };
  }, [connect, token]);

  return { isConnected, lastEvent };
}
