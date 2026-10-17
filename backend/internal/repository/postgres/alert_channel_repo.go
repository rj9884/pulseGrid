package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pulsegrid/backend/internal/domain"
)

type AlertChannelRepo struct {
	pool *pgxpool.Pool
}

func NewAlertChannelRepo(pool *pgxpool.Pool) *AlertChannelRepo {
	return &AlertChannelRepo{pool: pool}
}

func (r *AlertChannelRepo) Create(ctx context.Context, ch *domain.AlertChannel) error {
	query := `
		INSERT INTO alert_channels (id, user_id, name, webhook_url, is_enabled, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	if ch.ID == uuid.Nil {
		ch.ID = uuid.New()
	}
	if ch.CreatedAt.IsZero() {
		ch.CreatedAt = time.Now()
	}

	return r.pool.QueryRow(ctx, query,
		ch.ID, ch.UserID, ch.Name, ch.WebhookURL, ch.IsEnabled, ch.CreatedAt,
	).Scan(&ch.ID, &ch.CreatedAt)
}

func (r *AlertChannelRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.AlertChannel, error) {
	query := `
		SELECT id, user_id, name, webhook_url, is_enabled, created_at
		FROM alert_channels
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list alert channels: %w", err)
	}
	defer rows.Close()

	var channels []domain.AlertChannel
	for rows.Next() {
		var ch domain.AlertChannel
		err := rows.Scan(&ch.ID, &ch.UserID, &ch.Name, &ch.WebhookURL, &ch.IsEnabled, &ch.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan alert channel: %w", err)
		}
		channels = append(channels, ch)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate alert channels: %w", err)
	}

	return channels, nil
}

func (r *AlertChannelRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM alert_channels WHERE id = $1 AND user_id = $2`
	cmd, err := r.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("delete alert channel: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
