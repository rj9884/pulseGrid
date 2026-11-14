"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Radio, Zap } from "lucide-react";
import { LoginSchema, type LoginFormData } from "@/lib/schemas";
import { apiRequest, setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const res = await apiRequest<{ tokens: { access_token: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setAccessToken(res.tokens.access_token);
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to log in";
      setServerError(msg);
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      {/* Top Header with Navigation */}
      <header className="w-full border-b border-border-subtle bg-surface-base/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35)] transition-transform duration-200 group-hover:scale-105">
              <Zap className="h-4 w-4 fill-white" />
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-bold text-base text-white tracking-tight">PulseGrid</span>
              <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider text-text-accent px-1.5 py-0.2 rounded bg-brand-primary/10 border border-brand-primary/25">
                v1.0
              </span>
            </div>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={handleBack}
              className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-surface-card/40 px-3 py-1.5 text-xs sm:text-sm font-medium text-text-muted hover:border-border-hover hover:bg-surface-card hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
            <Link
              href="/"
              className="hidden sm:flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-surface-card/40 px-3 py-1.5 text-xs sm:text-sm font-medium text-text-muted hover:border-border-hover hover:bg-surface-card hover:text-white transition-colors"
            >
              <span>Home</span>
            </Link>
            <Link
              href="/status/global"
              className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-surface-card/40 px-3 py-1.5 text-xs sm:text-sm font-medium text-text-muted hover:border-border-hover hover:bg-surface-card hover:text-white transition-colors"
            >
              <Radio className="h-3.5 w-3.5 text-text-accent" />
              <span className="hidden sm:inline">Status Page</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Form */}
      <main className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md space-y-3">
          {/* In-page Breadcrumb / Backward Link */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={handleBack}
              className="inline-flex items-center space-x-1.5 text-xs text-text-muted hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to previous page</span>
            </button>
            <Link
              href="/"
              className="text-xs text-text-muted hover:text-text-accent transition-colors"
            >
              Home overview →
            </Link>
          </div>

          <Card className="border-border-default/80 bg-surface-base shadow-2xl">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35)]">
                <Zap className="h-5 w-5 fill-white" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">Welcome to PulseGrid</CardTitle>
              <CardDescription>Log in to access your real-time telemetry dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {serverError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                    {serverError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Email address</label>
                  <Input
                    type="email"
                    placeholder="developer@pulsegrid.dev"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full cursor-pointer" disabled={isSubmitting}>
                  {isSubmitting ? "Authenticating..." : "Sign In to Dashboard"}
                </Button>

                <div className="text-center text-xs text-text-muted pt-2">
                  Don&apos;t have an account?{" "}
                  <Link href="/register" className="text-text-accent hover:underline font-medium">
                    Create one
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border-subtle/50 py-4 text-center text-xs text-text-muted/60">
        PulseGrid Distributed Prober &bull; Millisecond Telemetry
      </footer>
    </div>
  );
}
