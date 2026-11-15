# Build stage
FROM golang:1.27-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /app

# Copy go mod files first for better caching
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy source code
COPY backend/ ./

# Build the binary
RUN CGO_ENABLED=0 go build -v -o /pulsegrid-api ./cmd/api
RUN CGO_ENABLED=0 go build -v -o /pulsegrid-migrate ./cmd/migrate

# Final stage
FROM alpine:3.20

# Install runtime dependencies (ca-certificates for HTTPS, tzdata for timezones)
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binaries from builder
COPY --from=builder /pulsegrid-api /app/pulsegrid-api
COPY --from=builder /pulsegrid-migrate /app/pulsegrid-migrate

# Copy migrations
COPY backend/migrations ./migrations

# Create non-root user
RUN adduser -D -g '' pulsegrid
USER pulsegrid

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/app/pulsegrid-api"]