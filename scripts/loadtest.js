import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 50 },  // Ramp-up to 50 VUs
    { duration: "30s", target: 200 }, // Ramp-up to 200 VUs
    { duration: "30s", target: 500 }, // Peak load at 500 VUs
    { duration: "20s", target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<50"], // 95% of requests must complete below 50ms
    http_req_failed: ["rate<0.01"],   // Error rate must be less than 1%
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:8080";

export default function () {
  // 1. Health check probe
  const healthRes = http.get(`${BASE_URL}/healthz`);
  check(healthRes, {
    "health status is 200": (r) => r.status === 200,
  });

  // 2. Public status overview
  const statusRes = http.get(`${BASE_URL}/api/v1/public/status`);
  check(statusRes, {
    "public status is 200": (r) => r.status === 200,
    "has status payload": (r) => r.json().system_status !== undefined,
  });

  // 3. Simulated user registration & auth token rotation
  const email = `k6_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}@pulsegrid.dev`;
  const registerPayload = JSON.stringify({
    email: email,
    password: "Password123!",
    role: "ADMIN",
  });

  const authParams = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const registerRes = http.post(`${BASE_URL}/api/v1/auth/register`, registerPayload, authParams);
  const registerOk = check(registerRes, {
    "register returned 201": (r) => r.status === 201,
  });

  if (registerOk) {
    const token = registerRes.json().tokens.access_token;
    const authHeaders = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };

    // 4. Create an endpoint monitor
    const monitorPayload = JSON.stringify({
      name: "Loadtest Probed API",
      url: "https://httpbin.org/status/200",
      method: "GET",
      expected_status: 200,
      interval_seconds: 30,
      timeout_ms: 3000,
    });

    const createRes = http.post(`${BASE_URL}/api/v1/monitors`, monitorPayload, authHeaders);
    check(createRes, {
      "monitor created with 201": (r) => r.status === 201,
    });

    // 5. Query monitors list
    const listRes = http.get(`${BASE_URL}/api/v1/monitors`, authHeaders);
    check(listRes, {
      "monitors list returned 200": (r) => r.status === 200,
    });
  }

  sleep(0.5);
}
