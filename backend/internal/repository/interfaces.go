package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
}

type MonitorRepository interface {
	Create(ctx context.Context, monitor *domain.Monitor) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Monitor, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.MonitorWithStats, error)
	FetchDueMonitors(ctx context.Context, limit int) ([]domain.MonitorJob, error)
	Update(ctx context.Context, monitor *domain.Monitor) error
	UpdateState(ctx context.Context, id uuid.UUID, status domain.MonitorStatus, consecutiveFailures int, lastCheckedAt time.Time) error
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	GetAggregatedMetrics(ctx context.Context, monitorID uuid.UUID, hours int) ([]domain.LatencyBucket, error)
	GetPublicSummary(ctx context.Context) ([]domain.MonitorWithStats, error)
}

type CheckResultRepository interface {
	Create(ctx context.Context, result *domain.CheckResult) error
	ListByMonitorID(ctx context.Context, monitorID uuid.UUID, limit, offset int) ([]domain.CheckResult, error)
	PurgeOlderThan(ctx context.Context, age time.Duration) (int64, error)
}

type IncidentRepository interface {
	Create(ctx context.Context, incident *domain.Incident) error
	GetOpenByMonitorID(ctx context.Context, monitorID uuid.UUID) (*domain.Incident, error)
	Resolve(ctx context.Context, id uuid.UUID, resolvedAt time.Time) error
	List(ctx context.Context, userID *uuid.UUID, limit, offset int) ([]domain.Incident, error)
}

type AlertChannelRepository interface {
	Create(ctx context.Context, channel *domain.AlertChannel) error
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.AlertChannel, error)
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}

type TokenStore interface {
	StoreRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string, expiry time.Duration) error
	ValidateRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string) (bool, error)
	RevokeRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string) error
	RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error
}

type EventPublisher interface {
	PublishCheckEvent(ctx context.Context, event domain.CheckEventPayload) error
	SubscribeCheckEvents(ctx context.Context, userID uuid.UUID) (<-chan domain.CheckEventPayload, func(), error)
	EnqueueAlert(ctx context.Context, alert domain.AlertNotificationJob) error
	ConsumeAlert(ctx context.Context) (*domain.AlertNotificationJob, error)
}
