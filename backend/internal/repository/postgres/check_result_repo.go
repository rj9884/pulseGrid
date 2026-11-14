package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pulsegrid/backend/internal/domain"
)

type CheckResultRepo struct {
	pool *pgxpool.Pool
}

func NewCheckResultRepo(pool *pgxpool.Pool) *CheckResultRepo {
	return &CheckResultRepo{pool: pool}
}

func (r *CheckResultRepo) Create(ctx context.Context, res *domain.CheckResult) error {
	query := `
		INSERT INTO check_results (
			monitor_id, status_code, latency_ms, dns_ms, connect_ms, tls_ms, ttfb_ms, is_up, error_message, checked_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`
	if res.CheckedAt.IsZero() {
		res.CheckedAt = time.Now()
	}

	return r.pool.QueryRow(ctx, query,
		res.MonitorID, res.StatusCode, res.LatencyMS, res.DNSMS, res.ConnectMS, res.TLSMS, res.TTFBMS,
		res.IsUp, res.ErrorMessage, res.CheckedAt,
	).Scan(&res.ID)
}

func (r *CheckResultRepo) ListByMonitorID(ctx context.Context, monitorID uuid.UUID, limit, offset int) ([]domain.CheckResult, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT id, monitor_id, status_code, latency_ms, dns_ms, connect_ms, tls_ms, ttfb_ms, is_up, error_message, checked_at
		FROM check_results
		WHERE monitor_id = $1
		ORDER BY checked_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, monitorID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list check results: %w", err)
	}
	defer rows.Close()

	var results []domain.CheckResult
	for rows.Next() {
		var item domain.CheckResult
		err := rows.Scan(
			&item.ID, &item.MonitorID, &item.StatusCode, &item.LatencyMS, &item.DNSMS,
			&item.ConnectMS, &item.TLSMS, &item.TTFBMS, &item.IsUp, &item.ErrorMessage, &item.CheckedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan check result: %w", err)
		}
		results = append(results, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate check results: %w", err)
	}

	return results, nil
}

func (r *CheckResultRepo) PurgeOlderThan(ctx context.Context, age time.Duration) (int64, error) {
	query := `DELETE FROM check_results WHERE checked_at < NOW() - ($1 || ' seconds')::INTERVAL`
	cmd, err := r.pool.Exec(ctx, query, int64(age.Seconds()))
	if err != nil {
		return 0, fmt.Errorf("purge check results: %w", err)
	}
	return cmd.RowsAffected(), nil
}
