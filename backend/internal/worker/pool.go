package worker

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/repository"
)

type PoolConfig struct {
	Concurrency         int
	FailureThreshold    int
	MonitorRepo         repository.MonitorRepository
	CheckResultRepo     repository.CheckResultRepository
	IncidentRepo        repository.IncidentRepository
	EventPublisher      repository.EventPublisher
	Prober              *Prober
	Logger              *slog.Logger
}

type WorkerPool struct {
	cfg        PoolConfig
	jobsChan   chan domain.MonitorJob
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewWorkerPool(cfg PoolConfig) *WorkerPool {
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 32
	}
	if cfg.FailureThreshold <= 0 {
		cfg.FailureThreshold = 2
	}

	bufferSize := cfg.Concurrency * 4
	jobsChan := make(chan domain.MonitorJob, bufferSize)

	return &WorkerPool{
		cfg:      cfg,
		jobsChan: jobsChan,
	}
}

func (p *WorkerPool) Start(ctx context.Context) {
	p.ctx, p.cancel = context.WithCancel(ctx)

	for i := 0; i < p.cfg.Concurrency; i++ {
		p.wg.Add(1)
		go p.workerLoop(i)
	}

	p.cfg.Logger.Info("worker pool started", "workers", p.cfg.Concurrency)
}

func (p *WorkerPool) Submit(job domain.MonitorJob) bool {
	select {
	case p.jobsChan <- job:
		QueueDepth.Set(float64(len(p.jobsChan)))
		return true
	default:
		QueueDepth.Set(float64(len(p.jobsChan)))
		p.cfg.Logger.Warn("worker pool jobs channel full, job dropped", "monitor_id", job.MonitorID)
		return false
	}
}

func (p *WorkerPool) Stop() {
	if p.cancel != nil {
		p.cancel()
	}
	close(p.jobsChan)
	p.wg.Wait()
	p.cfg.Logger.Info("worker pool stopped cleanly")
}

func (p *WorkerPool) workerLoop(_ int) {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			return
		case job, ok := <-p.jobsChan:
			if !ok {
				return
			}
			QueueDepth.Set(float64(len(p.jobsChan)))
			p.processJob(job)
		}
	}
}

func (p *WorkerPool) processJob(job domain.MonitorJob) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	probeResult := p.cfg.Prober.Execute(ctx, job)

	ProbeDurationSeconds.Observe(float64(probeResult.LatencyMS) / 1000.0)
	if probeResult.IsUp {
		ProbesTotal.WithLabelValues("up").Inc()
	} else {
		ProbesTotal.WithLabelValues("down").Inc()
	}

	now := time.Now()
	checkResult := &domain.CheckResult{
		MonitorID:    job.MonitorID,
		StatusCode:   probeResult.StatusCode,
		LatencyMS:    probeResult.LatencyMS,
		DNSMS:        probeResult.DNSMS,
		TLSMS:        probeResult.TLSMS,
		TTFBMS:       probeResult.TTFBMS,
		IsUp:         probeResult.IsUp,
		ErrorMessage: probeResult.ErrorMessage,
		CheckedAt:    now,
	}

	if err := p.cfg.CheckResultRepo.Create(ctx, checkResult); err != nil {
		p.cfg.Logger.Error("failed to persist check result", "monitor_id", job.MonitorID, "error", err)
	}

	newStatus, newFailures, statusChanged := EvaluateState(
		job.CurrentStatus,
		job.ConsecutiveFailures,
		probeResult.IsUp,
		p.cfg.FailureThreshold,
	)

	if err := p.cfg.MonitorRepo.UpdateState(ctx, job.MonitorID, newStatus, newFailures, now); err != nil {
		p.cfg.Logger.Error("failed to update monitor state", "monitor_id", job.MonitorID, "error", err)
	}

	// Anti-flapping incident trigger
	if statusChanged {
		if newStatus == domain.StatusDown {
			cause := "Health check failed"
			if probeResult.ErrorMessage != nil {
				cause = *probeResult.ErrorMessage
			}

			incident := &domain.Incident{
				ID:        uuid.New(),
				MonitorID: job.MonitorID,
				Status:    domain.IncidentOpen,
				Cause:     cause,
				StartedAt: now,
			}

			if err := p.cfg.IncidentRepo.Create(ctx, incident); err != nil {
				p.cfg.Logger.Error("failed to create incident", "monitor_id", job.MonitorID, "error", err)
			}

			_ = p.cfg.EventPublisher.EnqueueAlert(ctx, domain.AlertNotificationJob{
				IncidentID: incident.ID,
				MonitorID:  job.MonitorID,
				URL:        job.URL,
				Status:     domain.IncidentOpen,
				Cause:      cause,
				StartedAt:  now,
				UserID:     job.UserID,
			})
		} else if newStatus == domain.StatusUp && job.CurrentStatus == domain.StatusDown {
			// Resolve existing incident
			openInc, err := p.cfg.IncidentRepo.GetOpenByMonitorID(ctx, job.MonitorID)
			if err == nil && openInc != nil {
				_ = p.cfg.IncidentRepo.Resolve(ctx, openInc.ID, now)
				_ = p.cfg.EventPublisher.EnqueueAlert(ctx, domain.AlertNotificationJob{
					IncidentID: openInc.ID,
					MonitorID:  job.MonitorID,
					URL:        job.URL,
					Status:     domain.IncidentResolved,
					Cause:      "Endpoint recovered and responding normally",
					StartedAt:  openInc.StartedAt,
					ResolvedAt: &now,
					UserID:     job.UserID,
				})
			}
		}
	}

	// Broadcast live telemetry via Redis Pub/Sub for SSE
	_ = p.cfg.EventPublisher.PublishCheckEvent(ctx, domain.CheckEventPayload{
		MonitorID:     job.MonitorID,
		UserID:        job.UserID,
		Status:        newStatus,
		StatusChanged: statusChanged,
		StatusCode:    probeResult.StatusCode,
		LatencyMS:     probeResult.LatencyMS,
		DNSMS:         probeResult.DNSMS,
		TLSMS:         probeResult.TLSMS,
		TTFBMS:        probeResult.TTFBMS,
		IsUp:          probeResult.IsUp,
		ErrorMessage:  probeResult.ErrorMessage,
		CheckedAt:     now,
	})
}

// EvaluateState implements the anti-flapping state machine pure function
func EvaluateState(currentStatus domain.MonitorStatus, currentFailures int, isUp bool, threshold int) (domain.MonitorStatus, int, bool) {
	if isUp {
		newFailures := 0
		if currentStatus == domain.StatusDown {
			return domain.StatusUp, newFailures, true
		}
		if currentStatus == domain.StatusPending {
			return domain.StatusUp, newFailures, true
		}
		return domain.StatusUp, newFailures, false
	}

	newFailures := currentFailures + 1
	if newFailures >= threshold {
		if currentStatus != domain.StatusDown {
			return domain.StatusDown, newFailures, true
		}
		return domain.StatusDown, newFailures, false
	}

	// Consecutive failures < threshold (anti-flapping buffer)
	return currentStatus, newFailures, false
}
