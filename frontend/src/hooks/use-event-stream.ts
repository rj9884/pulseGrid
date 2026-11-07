"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckEventSchema, type CheckEvent, type Monitor } from "@/lib/schemas";
import { getAccessToken } from "@/lib/api";

const SSE_URL = process.env.NEXT_PUBLIC_SSE_URL || "http://localhost:8080/api/v1/stream/events";

interface CheckItemRecord {
  id: number;
  monitor_id: string;
  status_code?: number | null;
  latency_ms: number;
  dns_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  is_up: boolean;
  error_message?: string | null;
  checked_at: string;
}

export function useEventStream() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<CheckEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

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
              return {
                ...m,
                status: parsed.status,
                last_checked_at: parsed.checked_at,
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
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);

  return { isConnected, lastEvent };
}
