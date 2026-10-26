package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/repository"
)

type NotifierConfig struct {
	MaxRetries       int
	BaseBackoff      time.Duration
	CapBackoff       time.Duration
	EventPublisher   repository.EventPublisher
	AlertChannelRepo repository.AlertChannelRepository
	Logger           *slog.Logger
}

type Notifier struct {
	cfg        NotifierConfig
	httpClient *http.Client
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewNotifier(cfg NotifierConfig) *Notifier {
	if cfg.MaxRetries <= 0 {
		cfg.MaxRetries = 5
	}
	if cfg.BaseBackoff <= 0 {
		cfg.BaseBackoff = 2 * time.Second
	}
	if cfg.CapBackoff <= 0 {
		cfg.CapBackoff = 60 * time.Second
	}

	return &Notifier{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (n *Notifier) Start(ctx context.Context) {
	n.ctx, n.cancel = context.WithCancel(ctx)
	n.wg.Add(1)

	go func() {
		defer n.wg.Done()
		n.cfg.Logger.Info("notifier worker started")

		for {
			select {
			case <-n.ctx.Done():
				n.cfg.Logger.Info("notifier worker stopping")
				return
			default:
				job, err := n.cfg.EventPublisher.ConsumeAlert(n.ctx)
				if err != nil {
					time.Sleep(1 * time.Second)
					continue
				}
				if job == nil {
					continue
				}

				n.dispatchAlert(*job)
			}
		}
	}()
}

func (n *Notifier) Stop() {
	if n.cancel != nil {
		n.cancel()
	}
	n.wg.Wait()
	n.cfg.Logger.Info("notifier worker stopped cleanly")
}

func (n *Notifier) dispatchAlert(job domain.AlertNotificationJob) {
	channels, err := n.cfg.AlertChannelRepo.ListByUserID(n.ctx, job.UserID)
	if err != nil {
		n.cfg.Logger.Error("failed to retrieve alert channels", "user_id", job.UserID, "error", err)
		return
	}

	for _, ch := range channels {
		if !ch.IsEnabled {
			continue
		}

		payload := map[string]any{
			"event":        fmt.Sprintf("incident.%s", job.Status),
			"incident_id":  job.IncidentID,
			"monitor_id":   job.MonitorID,
			"target_url":   job.URL,
			"status":       job.Status,
			"cause":        job.Cause,
			"started_at":   job.StartedAt.Format(time.RFC3339),
			"channel_name": ch.Name,
		}
		if job.ResolvedAt != nil {
			payload["resolved_at"] = job.ResolvedAt.Format(time.RFC3339)
		}

		data, err := json.Marshal(payload)
		if err != nil {
			continue
		}

		go n.sendWebhookWithRetry(ch.WebhookURL, data)
	}
}

func (n *Notifier) sendWebhookWithRetry(webhookURL string, data []byte) {
	for attempt := 0; attempt < n.cfg.MaxRetries; attempt++ {
		req, err := http.NewRequestWithContext(n.ctx, http.MethodPost, webhookURL, bytes.NewReader(data))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "PulseGrid-Notifier/1.0")

		resp, err := n.httpClient.Do(req)
		if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
			_ = resp.Body.Close()
			return
		}

		if resp != nil {
			_ = resp.Body.Close()
		}

		backoff := CalculateJitterBackoff(attempt, n.cfg.BaseBackoff, n.cfg.CapBackoff)
		select {
		case <-n.ctx.Done():
			return
		case <-time.After(backoff):
		}
	}
}

func CalculateJitterBackoff(attempt int, base, capDuration time.Duration) time.Duration {
	multiplier := 1 << attempt
	maxSleep := base * time.Duration(multiplier)
	if maxSleep > capDuration {
		maxSleep = capDuration
	}
	if maxSleep <= 0 {
		return base
	}

	jitter := time.Duration(rand.Int63n(int64(maxSleep)))
	return jitter
}
