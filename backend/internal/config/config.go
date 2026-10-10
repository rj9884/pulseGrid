package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                         string
	DatabaseURL                  string
	RedisURL                     string
	JWTAccessSecret              string
	JWTRefreshSecret             string
	JWTAccessExpiry              time.Duration
	JWTRefreshExpiry             time.Duration
	WorkerConcurrency            int
	SchedulerInterval            time.Duration
	AllowPrivateNetworks         bool
	ConsecutiveFailuresThreshold int
	CORSAllowedOrigins           []string
}

func Load() *Config {
	accessExpMinutes := getEnvInt("JWT_ACCESS_EXP_MINUTES", 15)
	refreshExpDays := getEnvInt("JWT_REFRESH_EXP_DAYS", 7)
	concurrency := getEnvInt("WORKER_CONCURRENCY", 64)
	schedulerMs := getEnvInt("SCHEDULER_INTERVAL_MS", 1000)
	threshold := getEnvInt("CONSECUTIVE_FAILURES_THRESHOLD", 2)
	allowPrivate := getEnvBool("ALLOW_PRIVATE_NETWORKS", false)

	originsStr := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
	var origins []string
	for _, o := range strings.Split(originsStr, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	return &Config{
		Port:                         getEnv("PORT", "8080"),
		DatabaseURL:                  getEnv("DATABASE_URL", "postgres://pulsegrid:pulsegrid_secret@localhost:5432/pulsegrid_db?sslmode=disable"),
		RedisURL:                     getEnv("REDIS_URL", "localhost:6379"),
		JWTAccessSecret:              getEnv("JWT_ACCESS_SECRET", "pulsegrid_access_secret_super_secure_32_bytes_min"),
		JWTRefreshSecret:             getEnv("JWT_REFRESH_SECRET", "pulsegrid_refresh_secret_super_secure_32_bytes_min"),
		JWTAccessExpiry:              time.Duration(accessExpMinutes) * time.Minute,
		JWTRefreshExpiry:             time.Duration(refreshExpDays) * 24 * time.Hour,
		WorkerConcurrency:            concurrency,
		SchedulerInterval:            time.Duration(schedulerMs) * time.Millisecond,
		AllowPrivateNetworks:         allowPrivate,
		ConsecutiveFailuresThreshold: threshold,
		CORSAllowedOrigins:           origins,
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return fallback
	}
	return b
}
