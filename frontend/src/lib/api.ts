const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
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

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !endpoint.includes("/auth/")) {
    // Attempt token refresh
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
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
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/status")) {
          window.location.href = "/login";
        }
      }
    } catch {
      setAccessToken(null);
    }
  }

  if (!res.ok) {
    let errData: any;
    try {
      errData = await res.json();
    } catch {
      errData = { detail: res.statusText };
    }
    throw new ApiError(res.status, errData.detail || errData.message || "Request failed", errData);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}
