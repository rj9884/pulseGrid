package domain

import (
	"time"

	"github.com/google/uuid"
)

type CheckResult struct {
	ID           int64     `json:"id"`
	MonitorID    uuid.UUID `json:"monitor_id"`
	StatusCode   *int      `json:"status_code"`
	LatencyMS    int       `json:"latency_ms"`
	DNSMS        int       `json:"dns_ms"`
	TLSMS        int       `json:"tls_ms"`
	TTFBMS       int       `json:"ttfb_ms"`
	IsUp         bool      `json:"is_up"`
	ErrorMessage *string   `json:"error_message,omitempty"`
	CheckedAt    time.Time `json:"checked_at"`
}

type CheckEventPayload struct {
	MonitorID      uuid.UUID     `json:"monitor_id"`
	UserID         uuid.UUID     `json:"user_id"`
	Status         MonitorStatus `json:"status"`
	StatusChanged  bool          `json:"status_changed"`
	StatusCode     *int          `json:"status_code"`
	LatencyMS      int           `json:"latency_ms"`
	DNSMS          int           `json:"dns_ms"`
	TLSMS          int           `json:"tls_ms"`
	TTFBMS         int           `json:"ttfb_ms"`
	IsUp           bool          `json:"is_up"`
	ErrorMessage   *string       `json:"error_message,omitempty"`
	CheckedAt      time.Time     `json:"checked_at"`
}
