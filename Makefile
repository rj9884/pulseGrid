.PHONY: help docker-up docker-down migrate-up migrate-down test test-backend test-frontend run-backend run-frontend build lint

help:
	@echo "Available commands:"
	@echo "  make docker-up     - Start Postgres and Redis containers"
	@echo "  make docker-down   - Stop and remove containers"
	@echo "  make migrate-up    - Run database migrations"
	@echo "  make migrate-down  - Rollback latest database migration"
	@echo "  make test          - Run both backend and frontend tests"
	@echo "  make test-backend  - Run Go unit and race detector tests"
	@echo "  make test-frontend - Run Next.js Vitest unit tests"
	@echo "  make run-backend   - Start the Go API server"
	@echo "  make run-frontend  - Start the Next.js development server"
	@echo "  make build         - Build Go backend and Next.js frontend"
	@echo "  make lint          - Lint backend and frontend codebases"

docker-up:
	docker compose up -d

docker-down:
	docker compose down

migrate-up:
	cd backend && go run ./cmd/migrate up

migrate-down:
	cd backend && go run ./cmd/migrate down

test-backend:
	cd backend && go test -v -race -cover ./...

test-frontend:
	cd frontend && npm test

test: test-backend test-frontend

run-backend:
	cd backend && go run ./cmd/api/main.go

run-frontend:
	cd frontend && npm run dev

build:
	cd backend && CGO_ENABLED=0 go build -o bin/api ./cmd/api/main.go
	cd frontend && npm run build

lint:
	cd frontend && npm run lint
