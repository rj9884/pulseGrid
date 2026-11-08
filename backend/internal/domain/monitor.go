package domain

import (
	"time"

	"github.com/google/uuid"
)

type MonitorStatus string

const (
	StatusPending MonitorStatus = "PENDING"
	StatusUp      MonitorStatus = "UP"
	StatusDown    MonitorStatus = "DOWN"
	StatusPaused  MonitorStatus = "PAUSED"
)

type Monitor struct {
	ID                  uuid.UUID         `json:"id"`
	UserID              uuid.UUID         `json:"user_id"`
	Name                string            `json:"name"`
	URL                 string            `json:"url"`
	Method              string            `json:"method"`
	Headers             map[string]string `json:"headers"`
	ExpectedStatus      int               `json:"expected_status"`
	IntervalSeconds     int               `json:"interval_seconds"`
	TimeoutMS           int               `json:"timeout_ms"`
	Status              MonitorStatus     `json:"status"`
	ConsecutiveFailures int               `json:"consecutive_failures"`
	IsActive            bool              `json:"is_active"`
	LastCheckedAt       *time.Time        `json:"last_checked_at"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
}

type MonitorCreateInput struct {
	Name            string            `json:"name"`
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Headers         map[string]string `json:"headers"`
	ExpectedStatus  int               `json:"expected_status"`
	IntervalSeconds int               `json:"interval_seconds"`
	TimeoutMS       int               `json:"timeout_ms"`
}

type MonitorUpdateInput struct {
	Name            *string            `json:"name,omitempty"`
	URL             *string            `json:"url,omitempty"`
	Method          *string            `json:"method,omitempty"`
	Headers         *map[string]string `json:"headers,omitempty"`
	ExpectedStatus  *int               `json:"expected_status,omitempty"`
	IntervalSeconds *int               `json:"interval_seconds,omitempty"`
	TimeoutMS       *int               `json:"timeout_ms,omitempty"`
	IsActive        *bool              `json:"is_active,omitempty"`
}

type CheckResultSummary struct {
	ID           int64     `json:"id"`
	StatusCode   *int      `json:"status_code"`
	LatencyMS    int       `json:"latency_ms"`
	IsUp         bool      `json:"is_up"`
	ErrorMessage *string   `json:"error_message,omitempty"`
	CheckedAt    time.Time `json:"checked_at"`
}

type MonitorWithStats struct {
	Monitor
	Uptime24h      *float64             `json:"uptime_24h"`
	AvgLatency24h  int                  `json:"avg_latency_24h"`
	TotalChecks    int64                `json:"total_checks"`
	RecentChecks   []CheckResultSummary `json:"recent_checks"`
	LatestCheck    *CheckResult         `json:"latest_check,omitempty"`
}

type LatencyBucket struct {
	Bucket      time.Time `json:"bucket"`
	TotalChecks int64     `json:"total_checks"`
	UptimePct   float64   `json:"uptime_pct"`
	P50MS       float64   `json:"p50_ms"`
	P95MS       float64   `json:"p95_ms"`
	P99MS       float64   `json:"p99_ms"`
}

type MonitorJob struct {
	MonitorID           uuid.UUID
	UserID              uuid.UUID
	URL                 string
	Method              string
	Headers             map[string]string
	ExpectedStatus      int
	TimeoutMS           int
	ConsecutiveFailures int
	CurrentStatus       MonitorStatus
}
