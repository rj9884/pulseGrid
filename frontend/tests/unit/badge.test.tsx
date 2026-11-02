import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge Component", () => {
  it("renders success variant with correct text", () => {
    render(<Badge variant="success">OPERATIONAL</Badge>);
    const element = screen.getByText("OPERATIONAL");
    expect(element).toBeInTheDocument();
  });

  it("renders destructive variant for outage status", () => {
    render(<Badge variant="destructive">DOWN</Badge>);
    const element = screen.getByText("DOWN");
    expect(element).toBeInTheDocument();
  });
});
