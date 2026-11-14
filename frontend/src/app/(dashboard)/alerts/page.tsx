"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Bell, CheckCircle2, Shield, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/api";
import { AlertChannel, AlertChannelFormData, AlertChannelSchema } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: channels = [], isLoading } = useQuery<AlertChannel[]>({
    queryKey: ["alerts"],
    queryFn: () => apiRequest<AlertChannel[]>("/alerts"),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AlertChannelFormData>({
    resolver: zodResolver(AlertChannelSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: AlertChannelFormData) =>
      apiRequest<AlertChannel>("/alerts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err: Error) => {
      setModalError(err.message || "Failed to add alert channel");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/alerts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  return (
    <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1 space-y-7">
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-text-muted hover:text-white transition-colors bg-surface-card/40 border border-border-subtle px-2.5 py-1.5 rounded-lg self-start"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Alert Routing & Integrations</h1>
              <p className="text-xs sm:text-sm text-text-muted mt-1">
                Configure Webhook endpoints for automated incident dispatch to Slack, Discord, and on-call paging
              </p>
            </div>
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 self-start sm:self-auto cursor-pointer">
              <Plus className="h-4 w-4" />
              <span>Add Webhook</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Configured Notification Destinations</CardTitle>
                <CardDescription>
                  Webhooks are fired immediately upon state transitions between UP, DEGRADED, and DOWN
                </CardDescription>
              </div>
              <Shield className="h-5 w-5 text-text-muted opacity-60" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-xs sm:text-sm text-text-muted">
                Loading configured alert channels...
              </div>
            ) : channels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-default/70 bg-surface-base/50 p-12 text-center">
                <Bell className="mx-auto h-8 w-8 text-text-muted/60 mb-2" />
                <p className="text-sm font-medium text-text-secondary">No notification destinations configured.</p>
                <p className="text-xs text-text-muted mt-1">Connect your team chat to receive instantaneous incident notifications.</p>
                <Button onClick={() => setIsModalOpen(true)} variant="outline" className="mt-4">
                  Add Slack or Discord Webhook
                </Button>
              </div>
            ) : (
              <div className="grid gap-3.5">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between p-4 sm:p-5 rounded-xl border border-border-default/70 bg-surface-card/40 hover:border-border-hover/70 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-semibold text-white text-sm sm:text-base">{ch.name}</span>
                        <span className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      </div>
                      <p className="text-xs text-text-muted font-mono truncate max-w-xs sm:max-w-md bg-canvas/60 px-2 py-0.5 rounded border border-border-subtle/50">
                        {ch.webhook_url}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteMutation.mutate(ch.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove channel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add Channel Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Notification Webhook">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          {modalError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
              {modalError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Channel Name</label>
            <Input placeholder="e.g. #ops-incidents" {...register("name")} />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Webhook Destination URL</label>
            <Input placeholder="https://hooks.slack.com/services/..." {...register("webhook_url")} />
            {errors.webhook_url && <p className="text-xs text-red-400">{errors.webhook_url.message}</p>}
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-border-subtle">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Connecting..." : "Save Webhook"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
