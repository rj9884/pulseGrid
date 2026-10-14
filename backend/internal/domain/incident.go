package domain

import (
	"time"

	"github.com/google/uuid"
)

type IncidentStatus string

const (
	IncidentOpen     IncidentStatus = "OPEN"
	IncidentResolved IncidentStatus = "RESOLVED"
)

type Incident struct {
	ID          uuid.UUID      `json:"id"`
	MonitorID   uuid.UUID      `json:"monitor_id"`
	MonitorName string         `json:"monitor_name,omitempty"`
	Status      IncidentStatus `json:"status"`
	Cause       string         `json:"cause"`
	StartedAt   time.Time      `json:"started_at"`
	ResolvedAt  *time.Time     `json:"resolved_at,omitempty"`
	DurationSec *int64         `json:"duration_seconds,omitempty"`
}
