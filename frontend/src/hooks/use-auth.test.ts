import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/hooks/use-auth";
import { setAccessToken, getAccessToken } from "@/lib/api";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns unauthenticated when no token", () => {
    (getAccessToken as vi.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
  });

  it("returns authenticated when token exists", () => {
    (getAccessToken as vi.Mock).mockReturnValue("test-token");

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe("test-token");
  });

  it("calls setAccessToken(null) on logout", () => {
    (getAccessToken as vi.Mock).mockReturnValue("test-token");

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(setAccessToken).toHaveBeenCalledWith(null);
  });
});