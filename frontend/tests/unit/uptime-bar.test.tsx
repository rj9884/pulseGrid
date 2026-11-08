import { render, screen } from "@testing-library/react";
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
});
