FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /app/bin/api ./cmd/api/main.go
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /app/bin/migrate ./cmd/migrate/main.go

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S pulsegrid \
    && adduser -S pulsegrid -G pulsegrid

WORKDIR /app

COPY --from=builder /app/bin/api /app/bin/api
COPY --from=builder /app/bin/migrate /app/bin/migrate
COPY --from=builder /app/migrations /app/migrations

USER pulsegrid

EXPOSE 8080

ENTRYPOINT ["/app/bin/api"]
