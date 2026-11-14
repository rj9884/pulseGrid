"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Bell, LogIn, LogOut, Radio, UserPlus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEventStream } from "@/hooks/use-event-stream";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, logout } = useAuth();
  const { isConnected } = useEventStream();

  const handleLogout = () => {
    logout();
    queryClient.clear();
    router.push("/");
  };

  const navLinks = isAuthenticated
    ? [
        { href: "/", label: "Dashboard", icon: Activity },
        { href: "/incidents", label: "Incidents", icon: AlertTriangle },
        { href: "/alerts", label: "Alerts", icon: Bell },
        { href: "/status/global", label: "Status Page", icon: Radio },
      ]
    : [
        { href: "/", label: "Overview", icon: Activity },
        { href: "/status/global", label: "Status Page", icon: Radio },
      ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-surface-base/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center space-x-6 sm:space-x-8">
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

          <nav className="flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-surface-card text-white border border-border-default/80 shadow-xs"
                      : "text-text-muted hover:bg-surface-card/60 hover:text-white"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-brand-hover" : "text-text-muted")} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {isAuthenticated ? (
            <>
              <div className="flex items-center space-x-2 rounded-full border border-border-subtle bg-surface-card/40 px-2.5 py-1 text-xs">
                {isConnected ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                )}
                <span className="text-[11px] font-medium text-text-muted hidden sm:inline">
                  {isConnected ? "Live Pulse" : "Connecting..."}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-surface-card/30 px-2.5 py-1 text-xs font-medium text-text-muted hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                title="Log out of session and return to home"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/login"
                className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-surface-card/40 px-3 py-1.5 text-xs sm:text-sm font-medium text-text-muted hover:border-border-hover hover:bg-surface-card hover:text-white transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center space-x-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-brand-hover shadow-xs transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Get Started</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
