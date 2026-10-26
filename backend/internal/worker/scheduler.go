package worker

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/pulsegrid/backend/internal/repository"
)

type SchedulerConfig struct {
	Interval    time.Duration
	BatchSize   int
	MonitorRepo repository.MonitorRepository
	Pool        *WorkerPool
	Logger      *slog.Logger
}

type Scheduler struct {
	cfg    SchedulerConfig
	wg     sync.WaitGroup
	ctx    context.Context
	cancel context.CancelFunc
}

func NewScheduler(cfg SchedulerConfig) *Scheduler {
	if cfg.Interval <= 0 {
		cfg.Interval = 1 * time.Second
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 100
	}

	return &Scheduler{
		cfg: cfg,
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	s.ctx, s.cancel = context.WithCancel(ctx)
	s.wg.Add(1)

	go func() {
		defer s.wg.Done()
		ticker := time.NewTicker(s.cfg.Interval)
		defer ticker.Stop()

		s.cfg.Logger.Info("scheduler started", "interval_ms", s.cfg.Interval.Milliseconds(), "batch_size", s.cfg.BatchSize)

		for {
			select {
			case <-s.ctx.Done():
				s.cfg.Logger.Info("scheduler stopping")
				return
			case <-ticker.C:
				s.tick()
			}
		}
	}()
}

func (s *Scheduler) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
	s.cfg.Logger.Info("scheduler stopped cleanly")
}

func (s *Scheduler) tick() {
	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Second)
	defer cancel()

	jobs, err := s.cfg.MonitorRepo.FetchDueMonitors(ctx, s.cfg.BatchSize)
	if err != nil {
		s.cfg.Logger.Error("failed to query due monitors", "error", err)
		return
	}

	if len(jobs) == 0 {
		return
	}

	for _, job := range jobs {
		s.cfg.Pool.Submit(job)
	}
}
