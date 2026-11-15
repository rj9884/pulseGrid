import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 50 },  // Ramp-up to 50 VUs
    { duration: "30s", target: 100 }, // Peak load at 100 VUs
    { duration: "20s", target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete below 500ms
    http_req_failed: ["rate<0.01"],   // Error rate must be less than 1%
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:8080";

export default function () {
  // 1. Health check probe (local, fast)
  const healthRes = http.get(`${BASE_URL}/healthz`);
  check(healthRes, {
    "health status is 200": (r) => r.status === 200,
  });

  // 2. Public status overview (local, fast)
  const statusRes = http.get(`${BASE_URL}/api/v1/public/status`);
  check(statusRes, {
    "public status is 200": (r) => r.status === 200,
    "has status payload": (r) => r.json().system_status !== undefined,
  });

  sleep(0.5);
}