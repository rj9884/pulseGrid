package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pulsegrid/backend/internal/config"
	"github.com/pulsegrid/backend/internal/repository/postgres"
	"github.com/pulsegrid/backend/internal/repository/redis"
	"github.com/pulsegrid/backend/internal/service"
	transporthttp "github.com/pulsegrid/backend/internal/transport/http"
	"github.com/pulsegrid/backend/internal/transport/http/handlers"
	"github.com/pulsegrid/backend/internal/transport/http/sse"
	"github.com/pulsegrid/backend/internal/worker"
	"github.com/pulsegrid/backend/pkg/auth"
	"github.com/pulsegrid/backend/pkg/logger"
)

func main() {
	appLogger := logger.New()
	appLogger.Info("starting PulseGrid service")

	cfg := config.Load()

	rootCtx, rootCancel := context.WithCancel(context.Background())
	defer rootCancel()

	// 1. Initialize Postgres connection pool
	pgPool, err := postgres.NewPool(rootCtx, cfg.DatabaseURL)
	if err != nil {
		appLogger.Error("failed to connect to postgres", "error", err)
		os.Exit(1)
	}
	defer pgPool.Close()
	appLogger.Info("connected to postgres successfully")

	// 2. Initialize Redis client
	redisClient, err := redis.NewClient(rootCtx, cfg.RedisURL)
	if err != nil {
		appLogger.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()
	appLogger.Info("connected to redis successfully")

	// 3. Initialize Repositories
	userRepo := postgres.NewUserRepo(pgPool)
	monitorRepo := postgres.NewMonitorRepo(pgPool)
	checkResultRepo := postgres.NewCheckResultRepo(pgPool)
	incidentRepo := postgres.NewIncidentRepo(pgPool)
	alertChannelRepo := postgres.NewAlertChannelRepo(pgPool)

	// 4. Initialize Core Managers & Services
	jwtManager := auth.NewJWTManager(
		cfg.JWTAccessSecret,
		cfg.JWTRefreshSecret,
		cfg.JWTAccessExpiry,
		cfg.JWTRefreshExpiry,
	)

	authService := service.NewAuthService(userRepo, redisClient, jwtManager)
	monitorService := service.NewMonitorService(monitorRepo, checkResultRepo, cfg.AllowPrivateNetworks)
	incidentService := service.NewIncidentService(incidentRepo, alertChannelRepo)

	// 5. Initialize SSE Hub
	sseHub := sse.NewHub(redisClient, jwtManager, appLogger)

	// 6. Initialize HTTP Handlers & Router
	authHandler := handlers.NewAuthHandler(authService)
	monitorHandler := handlers.NewMonitorHandler(monitorService)
	incidentHandler := handlers.NewIncidentHandler(incidentService)

	router := transporthttp.NewRouter(transporthttp.RouterConfig{
		Config:          cfg,
		Logger:          appLogger,
		JWTManager:      jwtManager,
		AuthHandler:     authHandler,
		MonitorHandler:  monitorHandler,
		IncidentHandler: incidentHandler,
		SSEHub:          sseHub,
	})

	// 7. Initialize Prober & Background Worker Pool
	prober := worker.NewProber(cfg.AllowPrivateNetworks)
	workerPool := worker.NewWorkerPool(worker.PoolConfig{
		Concurrency:      cfg.WorkerConcurrency,
		FailureThreshold: cfg.ConsecutiveFailuresThreshold,
		MonitorRepo:      monitorRepo,
		CheckResultRepo:  checkResultRepo,
		IncidentRepo:     incidentRepo,
		EventPublisher:   redisClient,
		Prober:           prober,
		Logger:           appLogger,
	})
	workerPool.Start(rootCtx)

	// 8. Initialize Scheduler
	scheduler := worker.NewScheduler(worker.SchedulerConfig{
		Interval:    cfg.SchedulerInterval,
		BatchSize:   100,
		MonitorRepo: monitorRepo,
		Pool:        workerPool,
		Logger:      appLogger,
	})
	scheduler.Start(rootCtx)

	// 9. Initialize Webhook Notifier
	notifier := worker.NewNotifier(worker.NotifierConfig{
		MaxRetries:       5,
		BaseBackoff:      2 * time.Second,
		CapBackoff:       60 * time.Second,
		EventPublisher:   redisClient,
		AlertChannelRepo: alertChannelRepo,
		Logger:           appLogger,
	})
	notifier.Start(rootCtx)

	// 10. Start HTTP Server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		appLogger.Info("http server listening", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			appLogger.Error("server error", "error", err)
			rootCancel()
		}
	}()

	// 11. Graceful Shutdown on SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	appLogger.Info("shutdown signal received, initiating graceful teardown")
	rootCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	scheduler.Stop()
	workerPool.Stop()
	notifier.Stop()

	if err := server.Shutdown(shutdownCtx); err != nil {
		appLogger.Error("http server forced to shutdown", "error", err)
	}

	appLogger.Info("pulsegrid exited cleanly")
}
