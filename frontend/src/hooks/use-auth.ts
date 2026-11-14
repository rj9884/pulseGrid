"use client";

import { useSyncExternalStore, useCallback } from "react";
import { getAccessToken, setAccessToken } from "@/lib/api";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("pulsegrid-auth-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("pulsegrid-auth-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): string | null {
  return getAccessToken();
}

function getServerSnapshot(): string | null {
  return null;
}

export function useAuth() {
  const token = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isAuthenticated = !!token;

  const logout = useCallback(() => {
    setAccessToken(null);
  }, []);

  return {
    token,
    isAuthenticated,
    logout,
  };
}
