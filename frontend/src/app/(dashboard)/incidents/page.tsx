"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Incident } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

export default function IncidentsPage() {
  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: () => apiRequest<Incident[]>("/incidents"),
  });

  const openIncidents = incidents.filter((i) => i.status === "OPEN");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 py-8 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incidents & Outages</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Audit log of all detected outages, downtime durations, and automated resolutions
          </p>
        </div>

        {/* Active Outage Banner */}
        {openIncidents.length > 0 && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 space-y-2">
            <div className="flex items-center space-x-2 font-semibold">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <span>{openIncidents.length} Ongoing Outage(s) Detected</span>
            </div>
            <p className="text-xs text-red-300">
              Active alerts are currently dispatched to configured webhook channels.
            </p>
          </div>
        )}

        {/* Incidents Table / Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incident History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-zinc-500">Loading incident history...</div>
            ) : incidents.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-400 flex flex-col items-center space-y-2">
                <CheckCircle className="h-8 w-8 text-emerald-500 opacity-80" />
                <span>All systems operational — zero incidents recorded.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-200">
                          {inc.monitor_name || "Endpoint Monitor"}
                        </span>
                        <Badge variant={inc.status === "OPEN" ? "destructive" : "success"}>
                          {inc.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">{inc.cause}</p>
                    </div>

                    <div className="flex items-center space-x-6 text-xs text-zinc-400">
                      <div>
                        <span className="text-zinc-500 block">Started:</span>
                        <span>{new Date(inc.started_at).toLocaleString()}</span>
                      </div>
                      {inc.resolved_at && (
                        <div>
                          <span className="text-zinc-500 block">Downtime:</span>
                          <span className="font-semibold text-zinc-200 flex items-center space-x-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatDuration(inc.duration_seconds ?? 0)}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
