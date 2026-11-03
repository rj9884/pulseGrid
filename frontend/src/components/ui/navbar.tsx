"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, AlertTriangle, Bell, LogOut, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { setAccessToken } from "@/lib/api";
import { useEventStream } from "@/hooks/use-event-stream";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useEventStream();

  const handleLogout = () => {
    setAccessToken(null);
    router.push("/login");
  };

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/incidents", label: "Incidents", icon: AlertTriangle },
    { href: "/alerts", label: "Alerts", icon: Bell },
    { href: "/status/global", label: "Status Page", icon: Radio },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2 font-bold text-lg text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-extrabold text-xs">
              PG
            </span>
            <span>PulseGrid</span>
          </Link>
          <nav className="flex items-center space-x-1 sm:space-x-4">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                    isActive
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-xs">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
              )}
            />
            <span className="text-zinc-400 hidden sm:inline">
              {isConnected ? "Live Sync" : "Connecting..."}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
