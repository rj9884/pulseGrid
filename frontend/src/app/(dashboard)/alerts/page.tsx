"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Bell, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/api";
import { AlertChannel, AlertChannelFormData, AlertChannelSchema } from "@/lib/schemas";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    onError: (err: any) => {
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 py-8 flex-1 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notification Channels</h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Configure Webhook destinations for real-time Slack, Discord, and custom incident alerts
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-1.5 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            <span>Add Webhook</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Alert Channels</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-zinc-500">Loading channels...</div>
            ) : channels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center">
                <Bell className="mx-auto h-8 w-8 text-zinc-500 mb-2" />
                <p className="text-sm text-zinc-400">No alert channels configured yet.</p>
                <Button onClick={() => setIsModalOpen(true)} variant="outline" className="mt-4">
                  Add Slack or Discord Webhook
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-200">{ch.name}</span>
                        <span className="flex items-center space-x-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Active</span>
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono truncate max-w-xs sm:max-w-md">
                        {ch.webhook_url}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteMutation.mutate(ch.id)}
                      className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
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

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Notification Channel">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          {modalError && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400">
              {modalError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Channel Name</label>
            <Input placeholder="e.g. #ops-incidents" {...register("name")} />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Webhook URL</label>
            <Input placeholder="https://hooks.slack.com/services/..." {...register("webhook_url")} />
            {errors.webhook_url && <p className="text-xs text-red-400">{errors.webhook_url.message}</p>}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Webhook"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
