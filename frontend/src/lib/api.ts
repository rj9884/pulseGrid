// Use different API base URLs for server-side vs client-side rendering
// Server (SSR): can reach backend via Docker internal DNS (backend:8080)
// Client (browser): must use host-exposed port (localhost:8080)
const SERVER_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://backend:8080/api/v1";
const CLIENT_API_BASE = "/api/v1"; // Next.js rewrites proxy to backend

function getApiBase(): string {
  if (typeof window === "undefined") {
    return SERVER_API_BASE;
  }
  return CLIENT_API_BASE;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("pulsegrid_token", token);
    } else {
      localStorage.removeItem("pulsegrid_token");
    }
    window.dispatchEvent(new Event("pulsegrid-auth-change"));
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("pulsegrid_token");
  }
  return accessToken;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const apiBase = getApiBase();
  const url = endpoint.startsWith("http") ? endpoint : `${apiBase}${endpoint}`;

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !endpoint.includes("/auth/")) {
    // Attempt token refresh
    try {
      const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setAccessToken(data.access_token);
        headers.set("Authorization", `Bearer ${data.access_token}`);

        // Retry original request
        res = await fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
      } else {
        setAccessToken(null);
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/status") &&
          window.location.pathname !== "/"
        ) {
          window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        }
      }
    } catch {
      setAccessToken(null);
    }
  }

  if (!res.ok) {
    let errData: Record<string, unknown> = {};
    try {
      errData = (await res.json()) as Record<string, unknown>;
    } catch {
      errData = { detail: res.statusText };
    }
    const message =
      (typeof errData.detail === "string" && errData.detail) ||
      (typeof errData.message === "string" && errData.message) ||
      "Request failed";
    throw new ApiError(res.status, message, errData);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}
