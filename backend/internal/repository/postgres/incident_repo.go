package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pulsegrid/backend/internal/domain"
)

type IncidentRepo struct {
	pool *pgxpool.Pool
}

func NewIncidentRepo(pool *pgxpool.Pool) *IncidentRepo {
	return &IncidentRepo{pool: pool}
}

func (r *IncidentRepo) Create(ctx context.Context, inc *domain.Incident) error {
	query := `
		INSERT INTO incidents (id, monitor_id, status, cause, started_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, started_at
	`
	if inc.ID == uuid.Nil {
		inc.ID = uuid.New()
	}
	if inc.StartedAt.IsZero() {
		inc.StartedAt = time.Now()
	}

	return r.pool.QueryRow(ctx, query,
		inc.ID, inc.MonitorID, inc.Status, inc.Cause, inc.StartedAt,
	).Scan(&inc.ID, &inc.StartedAt)
}

func (r *IncidentRepo) GetOpenByMonitorID(ctx context.Context, monitorID uuid.UUID) (*domain.Incident, error) {
	query := `
		SELECT i.id, i.monitor_id, m.name, i.status, i.cause, i.started_at, i.resolved_at
		FROM incidents i
		JOIN monitors m ON m.id = i.monitor_id
		WHERE i.monitor_id = $1 AND i.status = 'OPEN'
		ORDER BY i.started_at DESC
		LIMIT 1
	`
	var inc domain.Incident
	err := r.pool.QueryRow(ctx, query, monitorID).Scan(
		&inc.ID, &inc.MonitorID, &inc.MonitorName, &inc.Status, &inc.Cause,
		&inc.StartedAt, &inc.ResolvedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get open incident: %w", err)
	}

	return &inc, nil
}

func (r *IncidentRepo) Resolve(ctx context.Context, id uuid.UUID, resolvedAt time.Time) error {
	query := `
		UPDATE incidents
		SET status = 'RESOLVED', resolved_at = $1
		WHERE id = $2 AND status = 'OPEN'
	`
	cmd, err := r.pool.Exec(ctx, query, resolvedAt, id)
	if err != nil {
		return fmt.Errorf("resolve incident: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *IncidentRepo) List(ctx context.Context, userID *uuid.UUID, limit, offset int) ([]domain.Incident, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT i.id, i.monitor_id, m.name, i.status, i.cause, i.started_at, i.resolved_at,
		       EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, NOW()) - i.started_at))::bigint AS duration_seconds
		FROM incidents i
		JOIN monitors m ON m.id = i.monitor_id
		WHERE ($1::uuid IS NULL OR m.user_id = $1)
		ORDER BY i.started_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list incidents: %w", err)
	}
	defer rows.Close()

	var incidents []domain.Incident
	for rows.Next() {
		var inc domain.Incident
		err := rows.Scan(
			&inc.ID, &inc.MonitorID, &inc.MonitorName, &inc.Status, &inc.Cause,
			&inc.StartedAt, &inc.ResolvedAt, &inc.DurationSec,
		)
		if err != nil {
			return nil, fmt.Errorf("scan incident: %w", err)
		}
		incidents = append(incidents, inc)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate incidents: %w", err)
	}

	return incidents, nil
}
