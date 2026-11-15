import { Suspense } from "react";
import { HomePageContent } from "./home-page-content";

async function getPublicStatus() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://backend:8080/api/v1";
  try {
    const res = await fetch(`${apiBase}/public/status?limit=20&offset=0`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        system_status: "OPERATIONAL",
        total_monitors: 0,
        monitors_up: 0,
        monitors_down: 0,
        monitors: [],
      };
    }
    return res.json();
  } catch {
    return {
      system_status: "OPERATIONAL",
      total_monitors: 0,
      monitors_up: 0,
      monitors_down: 0,
      monitors: [],
    };
  }
}

export default async function HomePage() {
  const publicStatus = await getPublicStatus();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas text-text-secondary flex flex-col">
        <div className="flex-1 flex items-center justify-center text-xs sm:text-sm text-text-muted">
          Initialising prober workspace...
        </div>
      </div>
    }>
      <HomePageContent initialPublicStatus={publicStatus} />
    </Suspense>
  );
}