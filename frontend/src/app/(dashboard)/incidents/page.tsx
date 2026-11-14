"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, ShieldCheck, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Incident } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

export default function IncidentsPage() {
  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: () => apiRequest<Incident[]>("/incidents"),
  });

  const openIncidents = incidents.filter((i) => i.status === "OPEN");

  return (
    <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1 space-y-7">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-text-muted hover:text-white transition-colors bg-surface-card/40 border border-border-subtle px-2.5 py-1.5 rounded-lg"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Incidents & Outages</h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Real-time audit log of detected downtime, flapping events, and automated resolution timelines
            </p>
          </div>
        </div>

        {/* Active Outage Banner */}
        {openIncidents.length > 0 && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200 space-y-2 shadow-[0_4px_24px_-4px_rgba(239,68,68,0.2)]">
            <div className="flex items-center space-x-2.5 font-bold text-sm sm:text-base">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <span>{openIncidents.length} Active Incident(s) in Progress</span>
            </div>
            <p className="text-xs text-red-300/90 pl-5">
              Automated notifications have been dispatched to registered webhook channels and escalations are active.
            </p>
          </div>
        )}

        {/* Incidents Table / Cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Incident Audit Trail</CardTitle>
                <CardDescription>
                  Chronological record of service disruptions and resolution durations
                </CardDescription>
              </div>
              <ShieldCheck className="h-5 w-5 text-text-muted opacity-60" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-xs sm:text-sm text-text-muted">
                Loading incident history stream...
              </div>
            ) : incidents.length === 0 ? (
              <div className="py-14 text-center text-xs sm:text-sm text-text-muted flex flex-col items-center space-y-2.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <span className="font-medium text-white">All systems operational</span>
                <span className="text-xs text-text-muted">Zero incidents recorded across all monitored endpoints.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 rounded-xl border border-border-default/70 bg-surface-card/40 hover:border-border-hover/70 transition-all gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-semibold text-white text-sm sm:text-base">
                          {inc.monitor_name || "Endpoint Monitor"}
                        </span>
                        <Badge variant={inc.status === "OPEN" ? "destructive" : "success"}>
                          <span className="flex items-center space-x-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                inc.status === "OPEN" ? "bg-red-400" : "bg-emerald-400"
                              }`}
                            />
                            <span>{inc.status}</span>
                          </span>
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted font-mono bg-canvas/60 px-2 py-0.5 rounded border border-border-subtle/50 w-fit">
                        {inc.cause}
                      </p>
                    </div>

                    <div className="flex items-center space-x-6 text-xs text-text-muted">
                      <div>
                        <span className="text-text-muted/60 block text-[11px] uppercase tracking-wider">Started</span>
                        <span className="font-mono text-text-secondary">{new Date(inc.started_at).toLocaleString()}</span>
                      </div>
                      {inc.resolved_at && (
                        <div>
                          <span className="text-text-muted/60 block text-[11px] uppercase tracking-wider">Downtime</span>
                          <span className="font-semibold text-white flex items-center space-x-1 font-mono">
                            <Clock className="h-3.5 w-3.5 text-text-accent" />
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
