package domain

import (
	"time"

	"github.com/google/uuid"
)

type AlertChannel struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	Name       string    `json:"name"`
	WebhookURL string    `json:"webhook_url"`
	IsEnabled  bool      `json:"is_enabled"`
	CreatedAt  time.Time `json:"created_at"`
}

type AlertChannelCreateInput struct {
	Name       string `json:"name"`
	WebhookURL string `json:"webhook_url"`
	IsEnabled  *bool  `json:"is_enabled,omitempty"`
}

type AlertNotificationJob struct {
	IncidentID  uuid.UUID      `json:"incident_id"`
	MonitorID   uuid.UUID      `json:"monitor_id"`
	MonitorName string         `json:"monitor_name"`
	URL         string         `json:"url"`
	Status      IncidentStatus `json:"status"`
	Cause       string         `json:"cause"`
	StartedAt   time.Time      `json:"started_at"`
	ResolvedAt  *time.Time     `json:"resolved_at,omitempty"`
	UserID      uuid.UUID      `json:"user_id"`
}
