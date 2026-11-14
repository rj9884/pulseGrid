package http

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/pulsegrid/backend/internal/config"
	"github.com/pulsegrid/backend/internal/transport/http/handlers"
	"github.com/pulsegrid/backend/internal/transport/http/middleware"
	"github.com/pulsegrid/backend/internal/transport/http/sse"
	"github.com/pulsegrid/backend/pkg/auth"
)

type RouterConfig struct {
	Config          *config.Config
	Logger          *slog.Logger
	JWTManager      *auth.JWTManager
	AuthHandler     *handlers.AuthHandler
	MonitorHandler  *handlers.MonitorHandler
	IncidentHandler *handlers.IncidentHandler
	SSEHub          *sse.Hub
}

func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(cfg.Logger))
	r.Use(middleware.Recovery(cfg.Logger))
	r.Use(middleware.MaxBytes(1 << 20)) // 1MB request body limit
	r.Use(chimiddleware.RealIP)

	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   cfg.Config.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"},
		ExposedHeaders:   []string{"Link", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	})
	r.Use(corsMiddleware.Handler)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		handlers.RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Handle("/metrics", promhttp.Handler())

	r.Route("/api/v1", func(api chi.Router) {
		// Public Auth routes
		api.Post("/auth/register", cfg.AuthHandler.Register)
		api.Post("/auth/login", cfg.AuthHandler.Login)
		api.Post("/auth/refresh", cfg.AuthHandler.Refresh)
		api.Post("/auth/logout", cfg.AuthHandler.Logout)

		// Public Status summary
		api.Get("/public/status", cfg.MonitorHandler.PublicStatus)

		// SSE Stream
		api.Get("/stream/events", cfg.SSEHub.ServeHTTP)

		// Protected endpoints
		api.Group(func(protected chi.Router) {
			protected.Use(middleware.Auth(cfg.JWTManager))

			// User
			protected.Get("/auth/me", cfg.AuthHandler.Me)

			// Monitors CRUD
			protected.Get("/monitors", cfg.MonitorHandler.List)
			protected.Post("/monitors", cfg.MonitorHandler.Create)
			protected.Get("/monitors/{id}", cfg.MonitorHandler.Get)
			protected.Patch("/monitors/{id}", cfg.MonitorHandler.Update)
			protected.Delete("/monitors/{id}", cfg.MonitorHandler.Delete)
			protected.Get("/monitors/{id}/checks", cfg.MonitorHandler.ListChecks)

			// Incidents
			protected.Get("/incidents", cfg.IncidentHandler.ListIncidents)

			// Alert channels
			protected.Get("/alerts", cfg.IncidentHandler.ListAlertChannels)
			protected.Post("/alerts", cfg.IncidentHandler.CreateAlertChannel)
			protected.Delete("/alerts/{id}", cfg.IncidentHandler.DeleteAlertChannel)
		})
	})

	return r
}
