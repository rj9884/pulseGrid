import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UptimeBar } from "@/components/ui/uptime-bar";

describe("UptimeBar Component", () => {
  it("renders empty state when no checks have been recorded", () => {
    render(<UptimeBar checks={[]} totalChecks={0} barCount={10} />);
    expect(screen.getByText("Awaiting initial probe")).toBeInTheDocument();
    expect(screen.getByText("No check data")).toBeInTheDocument();
  });

  it("renders real check results accurately with status and timing", () => {
    const checks = [
      {
        id: 1,
        status_code: 200,
        latency_ms: 120,
        is_up: true,
        checked_at: new Date().toISOString(),
      },
      {
        id: 2,
        status_code: 500,
        latency_ms: 450,
        is_up: false,
        error_message: "Internal Server Error",
        checked_at: new Date().toISOString(),
      },
    ];

    const { container } = render(
      <UptimeBar checks={checks} uptime={50.0} totalChecks={2} barCount={10} />
    );

    expect(screen.getByText("Recent checks")).toBeInTheDocument();
    expect(screen.getByText("50.00% uptime (2 checks)")).toBeInTheDocument();

    // Verify slots exist
    const slots = container.querySelectorAll(".cursor-pointer");
    expect(slots.length).toBe(10);
  });

  it("displays detail inspection panel when clicking on a check box", () => {
    const checks = [
      {
        id: 1,
        status_code: 200,
        latency_ms: 180,
        dns_ms: 15,
        tls_ms: 35,
        ttfb_ms: 120,
        is_up: true,
        checked_at: new Date().toISOString(),
      },
    ];

    const { container } = render(
      <UptimeBar checks={checks} uptime={100.0} totalChecks={1} barCount={5} />
    );

    // Initial state: inspection panel is not shown
    expect(screen.queryByText("Total Latency")).not.toBeInTheDocument();

    // Click the last slot (which corresponds to our check)
    const slots = container.querySelectorAll(".cursor-pointer");
    fireEvent.click(slots[slots.length - 1]);

    // Now inspection panel is visible with details
    expect(screen.getByText("Total Latency")).toBeInTheDocument();
    expect(screen.getByText("180 ms")).toBeInTheDocument();
    expect(screen.getByText("HTTP 200 OK")).toBeInTheDocument();
    expect(screen.getByText("15ms / 35ms")).toBeInTheDocument();
    expect(screen.getByText("120 ms")).toBeInTheDocument();

    // Dismiss by clicking close button
    const closeBtn = screen.getByLabelText("Close probe details");
    fireEvent.click(closeBtn);
    expect(screen.queryByText("Total Latency")).not.toBeInTheDocument();
  });

  it("displays failure diagnostic when clicking on a failed check box", () => {
    const checks = [
      {
        id: 2,
        status_code: 404,
        latency_ms: 220,
        is_up: false,
        error_message: "expected status 200, got 404",
        checked_at: new Date().toISOString(),
      },
    ];

    const { container } = render(
      <UptimeBar checks={checks} uptime={0.0} totalChecks={1} barCount={5} />
    );

    const slots = container.querySelectorAll(".cursor-pointer");
    fireEvent.click(slots[slots.length - 1]);

    expect(screen.getByText("Probe Failed / Outage")).toBeInTheDocument();
    expect(screen.getByText("expected status 200, got 404")).toBeInTheDocument();
    expect(screen.getByText("HTTP 404 Not Found")).toBeInTheDocument();
  });
});
