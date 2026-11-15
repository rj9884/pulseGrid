-- Add index for 24-hour window queries on check_results
CREATE INDEX IF NOT EXISTS idx_check_results_checked_at
    ON check_results (checked_at DESC)
    INCLUDE (monitor_id, is_up, latency_ms);