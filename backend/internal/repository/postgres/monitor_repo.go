package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pulsegrid/backend/internal/domain"
)

type MonitorRepo struct {
	pool *pgxpool.Pool
}

func NewMonitorRepo(pool *pgxpool.Pool) *MonitorRepo {
	return &MonitorRepo{pool: pool}
}

func (r *MonitorRepo) Create(ctx context.Context, m *domain.Monitor) error {
	query := `
		INSERT INTO monitors (
			id, user_id, name, url, method, headers, expected_status,
			interval_seconds, timeout_ms, status, consecutive_failures, is_active,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at
	`
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	now := time.Now()
	m.CreatedAt = now
	m.UpdatedAt = now

	headersJSON, err := json.Marshal(m.Headers)
	if err != nil {
		headersJSON = []byte("{}")
	}

	return r.pool.QueryRow(ctx, query,
		m.ID, m.UserID, m.Name, m.URL, m.Method, headersJSON, m.ExpectedStatus,
		m.IntervalSeconds, m.TimeoutMS, m.Status, m.ConsecutiveFailures, m.IsActive,
		m.CreatedAt, m.UpdatedAt,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
}

func (r *MonitorRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Monitor, error) {
	query := `
		SELECT id, user_id, name, url, method, headers, expected_status,
		       interval_seconds, timeout_ms, status, consecutive_failures,
		       is_active, last_checked_at, created_at, updated_at
		FROM monitors
		WHERE id = $1
	`
	var m domain.Monitor
	var headersBytes []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.UserID, &m.Name, &m.URL, &m.Method, &headersBytes, &m.ExpectedStatus,
		&m.IntervalSeconds, &m.TimeoutMS, &m.Status, &m.ConsecutiveFailures,
		&m.IsActive, &m.LastCheckedAt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get monitor: %w", err)
	}

	if len(headersBytes) > 0 {
		_ = json.Unmarshal(headersBytes, &m.Headers)
	}
	if m.Headers == nil {
		m.Headers = make(map[string]string)
	}

	return &m, nil
}

func (r *MonitorRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.MonitorWithStats, error) {
	query := `
		SELECT 
			m.id, m.user_id, m.name, m.url, m.method, m.headers, m.expected_status,
			m.interval_seconds, m.timeout_ms, m.status, m.consecutive_failures,
			m.is_active, m.last_checked_at, m.created_at, m.updated_at,
			stats.uptime_24h,
			COALESCE(stats.avg_latency_24h, 0) AS avg_latency_24h,
			COALESCE(stats.total_checks, 0) AS total_checks,
			COALESCE(
				(
					SELECT json_agg(r)
					FROM (
						SELECT id, status_code, latency_ms, dns_ms, tls_ms, ttfb_ms, is_up, error_message, checked_at
						FROM (
							SELECT id, status_code, latency_ms, dns_ms, tls_ms, ttfb_ms, is_up, error_message, checked_at
							FROM check_results
							WHERE monitor_id = m.id
							ORDER BY checked_at DESC
							LIMIT 40
						) sub
						ORDER BY checked_at ASC
					) r
				), '[]'::json
			) AS recent_checks
		FROM monitors m
		LEFT JOIN (
			SELECT 
				monitor_id,
				COUNT(*) AS total_checks,
				ROUND(100.0 * SUM(CASE WHEN is_up THEN 1 ELSE 0 END)::numeric / COUNT(*), 2) AS uptime_24h,
				COALESCE(ROUND(AVG(CASE WHEN is_up THEN latency_ms ELSE NULL END)), ROUND(AVG(latency_ms)), 0) AS avg_latency_24h
			FROM check_results
			WHERE checked_at >= NOW() - INTERVAL '24 hours'
			GROUP BY monitor_id
		) stats ON stats.monitor_id = m.id
		WHERE m.user_id = $1
		ORDER BY m.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list monitors by user: %w", err)
	}
	defer rows.Close()

	var result []domain.MonitorWithStats
	for rows.Next() {
		var item domain.MonitorWithStats
		var headersBytes []byte
		var recentChecksBytes []byte

		err := rows.Scan(
			&item.ID, &item.UserID, &item.Name, &item.URL, &item.Method, &headersBytes,
			&item.ExpectedStatus, &item.IntervalSeconds, &item.TimeoutMS, &item.Status,
			&item.ConsecutiveFailures, &item.IsActive, &item.LastCheckedAt, &item.CreatedAt,
			&item.UpdatedAt, &item.Uptime24h, &item.AvgLatency24h, &item.TotalChecks,
			&recentChecksBytes,
		)
		if err != nil {
			return nil, fmt.Errorf("scan monitor: %w", err)
		}

		if len(headersBytes) > 0 {
			_ = json.Unmarshal(headersBytes, &item.Headers)
		}
		if item.Headers == nil {
			item.Headers = make(map[string]string)
		}

		if len(recentChecksBytes) > 0 {
			_ = json.Unmarshal(recentChecksBytes, &item.RecentChecks)
		}
		if item.RecentChecks == nil {
			item.RecentChecks = []domain.CheckResultSummary{}
		}

		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate monitors: %w", err)
	}

	return result, nil
}

func (r *MonitorRepo) GetByIDWithStats(ctx context.Context, id uuid.UUID) (*domain.MonitorWithStats, error) {
	query := `
		SELECT 
			m.id, m.user_id, m.name, m.url, m.method, m.headers, m.expected_status,
			m.interval_seconds, m.timeout_ms, m.status, m.consecutive_failures,
			m.is_active, m.last_checked_at, m.created_at, m.updated_at,
			stats.uptime_24h,
			COALESCE(stats.avg_latency_24h, 0) AS avg_latency_24h,
			COALESCE(stats.total_checks, 0) AS total_checks,
			COALESCE(
				(
					SELECT json_agg(r)
					FROM (
						SELECT id, status_code, latency_ms, dns_ms, tls_ms, ttfb_ms, is_up, error_message, checked_at
						FROM (
							SELECT id, status_code, latency_ms, dns_ms, tls_ms, ttfb_ms, is_up, error_message, checked_at
							FROM check_results
							WHERE monitor_id = m.id
							ORDER BY checked_at DESC
							LIMIT 48
						) sub
						ORDER BY checked_at ASC
					) r
				), '[]'::json
			) AS recent_checks
		FROM monitors m
		LEFT JOIN (
			SELECT 
				monitor_id,
				COUNT(*) AS total_checks,
				ROUND(100.0 * SUM(CASE WHEN is_up THEN 1 ELSE 0 END)::numeric / COUNT(*), 2) AS uptime_24h,
				COALESCE(ROUND(AVG(CASE WHEN is_up THEN latency_ms ELSE NULL END)), ROUND(AVG(latency_ms)), 0) AS avg_latency_24h
			FROM check_results
			WHERE checked_at >= NOW() - INTERVAL '24 hours'
			GROUP BY monitor_id
		) stats ON stats.monitor_id = m.id
		WHERE m.id = $1
	`

	var item domain.MonitorWithStats
	var headersBytes []byte
	var recentChecksBytes []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&item.ID, &item.UserID, &item.Name, &item.URL, &item.Method, &headersBytes,
		&item.ExpectedStatus, &item.IntervalSeconds, &item.TimeoutMS, &item.Status,
		&item.ConsecutiveFailures, &item.IsActive, &item.LastCheckedAt, &item.CreatedAt,
		&item.UpdatedAt, &item.Uptime24h, &item.AvgLatency24h, &item.TotalChecks,
		&recentChecksBytes,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get monitor with stats: %w", err)
	}

	if len(headersBytes) > 0 {
		_ = json.Unmarshal(headersBytes, &item.Headers)
	}
	if item.Headers == nil {
		item.Headers = make(map[string]string)
	}

	if len(recentChecksBytes) > 0 {
		_ = json.Unmarshal(recentChecksBytes, &item.RecentChecks)
	}
	if item.RecentChecks == nil {
		item.RecentChecks = []domain.CheckResultSummary{}
	}

	return &item, nil
}

func (r *MonitorRepo) FetchDueMonitors(ctx context.Context, limit int) ([]domain.MonitorJob, error) {
	query := `
		SELECT id, user_id, url, method, headers, expected_status, timeout_ms, consecutive_failures, status
		FROM monitors
		WHERE is_active = TRUE
		  AND (last_checked_at IS NULL OR last_checked_at + (interval_seconds * INTERVAL '1 second') <= NOW())
		ORDER BY last_checked_at ASC NULLS FIRST
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("fetch due monitors: %w", err)
	}
	defer rows.Close()

	var jobs []domain.MonitorJob
	for rows.Next() {
		var job domain.MonitorJob
		var headersBytes []byte

		err := rows.Scan(
			&job.MonitorID, &job.UserID, &job.URL, &job.Method, &headersBytes,
			&job.ExpectedStatus, &job.TimeoutMS, &job.ConsecutiveFailures, &job.CurrentStatus,
		)
		if err != nil {
			return nil, fmt.Errorf("scan due monitor: %w", err)
		}

		if len(headersBytes) > 0 {
			_ = json.Unmarshal(headersBytes, &job.Headers)
		}
		if job.Headers == nil {
			job.Headers = make(map[string]string)
		}

		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate due monitors: %w", err)
	}

	return jobs, nil
}

// MarkMonitorsChecked updates last_checked_at for the given monitor IDs.
// This should be called after successfully submitting jobs to the worker pool.
func (r *MonitorRepo) MarkMonitorsChecked(ctx context.Context, monitorIDs []uuid.UUID, checkedAt time.Time) error {
	if len(monitorIDs) == 0 {
		return nil
	}

	query := `
		UPDATE monitors
		SET last_checked_at = $1, updated_at = NOW()
		WHERE id = ANY($2)
	`
	_, err := r.pool.Exec(ctx, query, checkedAt, monitorIDs)
	if err != nil {
		return fmt.Errorf("mark monitors checked: %w", err)
	}
	return nil
}

func (r *MonitorRepo) Update(ctx context.Context, m *domain.Monitor) error {
	query := `
		UPDATE monitors
		SET name = $1, url = $2, method = $3, headers = $4, expected_status = $5,
		    interval_seconds = $6, timeout_ms = $7, is_active = $8, updated_at = NOW()
		WHERE id = $9 AND user_id = $10
		RETURNING updated_at
	`
	headersJSON, err := json.Marshal(m.Headers)
	if err != nil {
		headersJSON = []byte("{}")
	}

	cmd, err := r.pool.Exec(ctx, query,
		m.Name, m.URL, m.Method, headersJSON, m.ExpectedStatus,
		m.IntervalSeconds, m.TimeoutMS, m.IsActive, m.ID, m.UserID,
	)
	if err != nil {
		return fmt.Errorf("update monitor: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *MonitorRepo) UpdateState(ctx context.Context, id uuid.UUID, status domain.MonitorStatus, consecutiveFailures int, lastCheckedAt time.Time) error {
	query := `
		UPDATE monitors
		SET status = $1, consecutive_failures = $2, last_checked_at = $3, updated_at = NOW()
		WHERE id = $4
	`
	_, err := r.pool.Exec(ctx, query, status, consecutiveFailures, lastCheckedAt, id)
	if err != nil {
		return fmt.Errorf("update monitor state: %w", err)
	}
	return nil
}

func (r *MonitorRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM monitors WHERE id = $1 AND user_id = $2`
	cmd, err := r.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("delete monitor: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *MonitorRepo) GetAggregatedMetrics(ctx context.Context, monitorID uuid.UUID, hours int) ([]domain.LatencyBucket, error) {
	if hours <= 0 {
		hours = 24
	}
	query := `
		SELECT
			date_trunc('hour', checked_at) AS bucket,
			COUNT(*) AS total_checks,
			ROUND(100.0 * SUM(CASE WHEN is_up THEN 1 ELSE 0 END)::numeric / COUNT(*), 2) AS uptime_pct,
			COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::float8 AS p50_ms,
			COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::float8 AS p95_ms,
			COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::float8 AS p99_ms
		FROM check_results
		WHERE monitor_id = $1
		  AND checked_at >= NOW() - ($2 || ' hours')::INTERVAL
		GROUP BY bucket
		ORDER BY bucket ASC;
	`

	rows, err := r.pool.Query(ctx, query, monitorID, hours)
	if err != nil {
		return nil, fmt.Errorf("get aggregated metrics: %w", err)
	}
	defer rows.Close()

	var buckets []domain.LatencyBucket
	for rows.Next() {
		var b domain.LatencyBucket
		if err := rows.Scan(&b.Bucket, &b.TotalChecks, &b.UptimePct, &b.P50MS, &b.P95MS, &b.P99MS); err != nil {
			return nil, fmt.Errorf("scan latency bucket: %w", err)
		}
		buckets = append(buckets, b)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate metrics: %w", err)
	}

	return buckets, nil
}

func (r *MonitorRepo) GetPublicSummary(ctx context.Context, limit, offset int) ([]domain.MonitorWithStats, error) {
	// Use LATERAL JOIN for recent_checks to avoid correlated subquery per monitor
	// This executes the subquery once per row in the driving table (monitors) rather than
	// re-evaluating for each monitor in a correlated fashion.
	query := `
		SELECT
			m.id, m.user_id, m.name, m.url, m.method, m.headers, m.expected_status,
			m.interval_seconds, m.timeout_ms, m.status, m.consecutive_failures,
			m.is_active, m.last_checked_at, m.created_at, m.updated_at,
			stats.uptime_24h,
			COALESCE(stats.avg_latency_24h, 0) AS avg_latency_24h,
			COALESCE(stats.total_checks, 0) AS total_checks,
			COALESCE(recent.recent_checks, '[]'::json) AS recent_checks
		FROM monitors m
		LEFT JOIN (
			SELECT
				monitor_id,
				COUNT(*) AS total_checks,
				ROUND(100.0 * SUM(CASE WHEN is_up THEN 1 ELSE 0 END)::numeric / COUNT(*), 2) AS uptime_24h,
				COALESCE(ROUND(AVG(CASE WHEN is_up THEN latency_ms ELSE NULL END)), ROUND(AVG(latency_ms)), 0) AS avg_latency_24h
			FROM check_results
			WHERE checked_at >= NOW() - INTERVAL '24 hours'
			GROUP BY monitor_id
		) stats ON stats.monitor_id = m.id
		LEFT JOIN LATERAL (
			SELECT json_agg(r) AS recent_checks
			FROM (
				SELECT id, status_code, latency_ms, dns_ms, connect_ms, tls_ms, ttfb_ms, is_up, error_message, checked_at
				FROM check_results
				WHERE monitor_id = m.id
				ORDER BY checked_at DESC
				LIMIT 40
			) r
		) recent ON true
		WHERE m.is_active = TRUE
		ORDER BY m.name ASC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("get public summary: %w", err)
	}
	defer rows.Close()

	var result []domain.MonitorWithStats
	for rows.Next() {
		var item domain.MonitorWithStats
		var headersBytes []byte
		var recentChecksBytes []byte

		err := rows.Scan(
			&item.ID, &item.UserID, &item.Name, &item.URL, &item.Method, &headersBytes,
			&item.ExpectedStatus, &item.IntervalSeconds, &item.TimeoutMS, &item.Status,
			&item.ConsecutiveFailures, &item.IsActive, &item.LastCheckedAt, &item.CreatedAt,
			&item.UpdatedAt, &item.Uptime24h, &item.AvgLatency24h, &item.TotalChecks,
			&recentChecksBytes,
		)
		if err != nil {
			return nil, fmt.Errorf("scan public monitor: %w", err)
		}

		if len(headersBytes) > 0 {
			_ = json.Unmarshal(headersBytes, &item.Headers)
		}
		if item.Headers == nil {
			item.Headers = make(map[string]string)
		}

		if len(recentChecksBytes) > 0 {
			_ = json.Unmarshal(recentChecksBytes, &item.RecentChecks)
		}
		if item.RecentChecks == nil {
			item.RecentChecks = []domain.CheckResultSummary{}
		}

		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate public monitors: %w", err)
	}

	return result, nil
}
