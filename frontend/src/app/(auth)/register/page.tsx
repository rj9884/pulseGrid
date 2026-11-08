"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap } from "lucide-react";
import { RegisterSchema, type RegisterFormData } from "@/lib/schemas";
import { apiRequest, setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "ADMIN",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const res = await apiRequest<{ tokens: { access_token: string } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setAccessToken(res.tokens.access_token);
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      setServerError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-canvas">
      <Card className="w-full max-w-md border-border-default/80 bg-surface-base shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35)]">
            <Zap className="h-5 w-5 fill-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Create Account</CardTitle>
          <CardDescription>Deploy instant distributed health monitoring for your APIs</CardDescription>
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
                placeholder="At least 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Initial Role</label>
              <select
                {...register("role")}
                className="flex h-9 w-full rounded-lg border border-border-default bg-canvas px-3 py-1 text-xs sm:text-sm text-text-primary shadow-inner focus-visible:outline-none focus-visible:border-brand-primary"
              >
                <option value="ADMIN">Admin (Full Control)</option>
                <option value="VIEWER">Viewer (Read Only)</option>
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center text-xs text-text-muted pt-2">
              Already have an account?{" "}
              <Link href="/login" className="text-text-accent hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
