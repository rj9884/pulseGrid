# PulseGrid

> High-throughput, distributed API uptime monitor and real-time incident engine.

PulseGrid schedules concurrent health checks across registered HTTP/HTTPS endpoints, records granular network timings (DNS, TLS, TTFB, total latency), detects anomalies and downtime with an anti-flapping state machine, dispatches webhook alerts with exponential backoff and jitter, and streams live telemetry to a Next.js dashboard over Server-Sent Events (SSE).

---

## Architecture Overview

PulseGrid follows a decoupled, event-driven Clean / Hexagonal Architecture in Go, with persistence backed by PostgreSQL 16 and Redis 7, paired with a Next.js 16 (App Router, TypeScript) frontend:

```text
┌────────────────────────────────────────────────────────┐
│               Next.js 16 Client & SSR                 │
│   (Dashboard, Status Page, TanStack Query, SSE Hook)   │
└───────────────▲────────────────────────▲───────────────┘
                │ REST (JWT)             │ Server-Sent Events
┌───────────────▼────────────────────────┴───────────────┐
│                   Go Backend Engine                    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│ │  Chi Router  │ │  Worker Pool │ │ Webhook Notifier │ │
│ └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘ │
└────────┼────────────────┼──────────────────┼───────────┘
         │                │                  │
┌────────▼───────┐ ┌──────▼───────┐ ┌────────▼─────────┐
│ PostgreSQL 16  │ │   Redis 7    │ │ Target Endpoints │
│ (Timeseries)   │ │  (Pub/Sub)   │ │    & Webhooks    │
└────────────────┘ └──────────────┘ └──────────────────┘
```

---

## Key Features

- **Concurrent Probing Engine:** Bounded worker pool processing 500+ probes/sec with strict context timeouts and zero goroutine leaks.
- **Granular Phase Timing:** Network profiler utilizing `net/http/httptrace` to measure DNS resolution, TLS handshake, and Time-to-First-Byte (TTFB).
- **Anti-Flapping State Machine:** Consecutive failure threshold evaluation ($N=2$) preventing false alarms from intermittent transient hiccups.
- **Real-Time Telemetry:** Unidirectional Server-Sent Events (SSE) broadcasting live probe results directly into the client-side TanStack Query cache.
- **Alerting with Backoff:** Webhook dispatcher for Slack, Discord, and custom endpoints with exponential backoff and full jitter ($t = \text{rand}(0, \min(60\text{s}, 2^k \cdot 2\text{s}))$).
- **SSRF Prevention:** Validates hostnames against loopback, private RFC 1918, link-local, and cloud metadata IP ranges prior to dispatching requests.
- **Public Status Page:** Unauthenticated SSR status page (`/status/[slug]`) for public uptime visibility and SEO indexing.

---

## Quickstart

Get PulseGrid up and running locally in under 2 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/rj9884/pulseGrid.git
cd pulseGrid

# 2. Install dependencies (Go modules + npm packages)
make setup

# 3. Start PostgreSQL 16 & Redis 7 containers
make docker-up

# 4. Execute database schema migrations
make migrate-up

# 5. Launch backend API engine (Terminal 1)
make run-backend

# 6. Launch frontend Next.js interface (Terminal 2)
make run-frontend
```

Once running, access the services:
- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8080](http://localhost:8080)
- **Health Check:** [http://localhost:8080/healthz](http://localhost:8080/healthz)
- **Prometheus Metrics:** [http://localhost:8080/metrics](http://localhost:8080/metrics)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Go 1.24+, Chi v5, pgx/v5 (`pgxpool`), go-redis v9, golang-jwt v5 |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query v5, Recharts |
| **Databases** | PostgreSQL 16 (with B-Tree composite indexing), Redis 7 (Pub/Sub & token revocation) |
| **Testing** | Go `testing` + `testify` (`-race`), Vitest + React Testing Library, k6 load testing |
| **Containerization** | Multi-stage Dockerfiles, Docker Compose |

---

## Directory Layout

```text
pulseGrid/
├── backend/
│   ├── cmd/
│   │   ├── api/          # Application entrypoint & graceful shutdown
│   │   └── migrate/      # Standalone schema migration CLI
│   ├── internal/
│   │   ├── config/       # Environment parsing & validation
│   │   ├── domain/       # Core business entities & RFC 7807 problem details
│   │   ├── repository/   # PostgreSQL (pgx/v5) and Redis adapters
│   │   ├── service/      # Business logic (Auth, Monitors, Incidents)
│   │   ├── transport/    # HTTP handlers, Chi router, middleware & SSE hub
│   │   └── worker/       # httptrace prober, bounded worker pool, scheduler, notifier
│   ├── migrations/       # Up/Down SQL schema migrations
│   └── pkg/              # Logger (slog), JWT/Hash, SSRF filter, input validator
├── frontend/
│   ├── src/
│   │   ├── app/          # App router pages (dashboard, auth, monitors, incidents, status)
│   │   ├── components/   # UI primitives & Recharts latency visualization
│   │   ├── hooks/        # useEventStream SSE hook
│   │   └── lib/          # API client, Zod schemas, utilities
│   └── tests/            # Vitest unit & component tests
├── scripts/
│   └── loadtest.js       # k6 performance & throughput benchmark
├── docker-compose.yml    # PostgreSQL 16 & Redis 7 orchestration
└── Makefile              # Common commands
```

---

## Getting Started

### Prerequisites

- [Go](https://go.dev/) (1.22+)
- [Node.js](https://nodejs.org/) (22+) & `npm`
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Install Dependencies

Install Go module dependencies and frontend npm packages:

```bash
make setup
```

Or individually:
```bash
make install-backend  # Download Go modules
make install-frontend # Install npm packages
```

### 2. Start Infrastructure Services

Start PostgreSQL and Redis in the background:

```bash
make docker-up
```

### 3. Apply Database Migrations

Apply SQL migrations:

```bash
make migrate-up
```

### 4. Run Backend Service

Start the Go API server:

```bash
make run-backend
```

The API server will listen on `http://localhost:8080`.
- Health check: `http://localhost:8080/healthz`
- Prometheus metrics: `http://localhost:8080/metrics`

### 5. Run Frontend Dashboard

Start Next.js development server:

```bash
make run-frontend
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

### Backend (`backend/.env` or shell environment)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP port for API server |
| `DATABASE_URL` | `postgres://pulsegrid:pulsegrid_secret@localhost:5432/pulsegrid_db?sslmode=disable` | PostgreSQL connection string |
| `REDIS_URL` | `localhost:6379` | Redis connection address |
| `JWT_ACCESS_SECRET` | `pulsegrid_access_secret_super_secure_32_bytes_min` | HMAC secret for access tokens |
| `JWT_REFRESH_SECRET` | `pulsegrid_refresh_secret_super_secure_32_bytes_min` | HMAC secret for refresh tokens |
| `WORKER_CONCURRENCY` | `64` | Worker pool goroutine count |
| `SCHEDULER_INTERVAL_MS` | `1000` | Scheduler polling interval in milliseconds |
| `ALLOW_PRIVATE_NETWORKS` | `false` | Set `true` in local environments to allow probing localhost/RFC1918 IPs |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/api/v1` | Backend API base URL |
| `NEXT_PUBLIC_SSE_URL` | `http://localhost:8080/api/v1/stream/events` | SSE streaming endpoint |

---

## API Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new user account | No |
| `POST` | `/api/v1/auth/login` | Authenticate & receive tokens | No |
| `POST` | `/api/v1/auth/refresh` | Rotate access token | Cookie / Bearer |
| `POST` | `/api/v1/auth/logout` | Revoke token and clear session | Cookie / Bearer |
| `GET` | `/api/v1/auth/me` | Current authenticated user profile | Bearer |
| `GET` | `/api/v1/monitors` | List monitors with 24h uptime & avg latency | Bearer |
| `POST` | `/api/v1/monitors` | Create a new endpoint monitor | Bearer |
| `GET` | `/api/v1/monitors/{id}` | Monitor details and 24h percentile latency buckets | Bearer |
| `PATCH` | `/api/v1/monitors/{id}` | Update monitor or pause/resume checks | Bearer |
| `DELETE` | `/api/v1/monitors/{id}` | Delete a monitor | Bearer |
| `GET` | `/api/v1/monitors/{id}/checks` | Paginated check result history | Bearer |
| `GET` | `/api/v1/incidents` | List active and resolved incidents | Bearer |
| `GET` | `/api/v1/alerts` | List configured notification webhooks | Bearer |
| `POST` | `/api/v1/alerts` | Create notification webhook channel | Bearer |
| `DELETE` | `/api/v1/alerts/{id}` | Delete notification webhook channel | Bearer |
| `GET` | `/api/v1/stream/events` | Server-Sent Events stream for live check events | Bearer / Query |
| `GET` | `/api/v1/public/status` | Public status overview for status page | No |

---

## Testing & Quality Gates

Run all unit tests across backend and frontend:

```bash
make test
```

Or individually:

```bash
# Go unit tests with race detection and statement coverage
make test-backend

# Next.js Vitest unit tests
make test-frontend
```

### Benchmarks (k6)

Run the load testing benchmark:

```bash
k6 run scripts/loadtest.js
```

---

## License

MIT
