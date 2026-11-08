package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/repository"
	"github.com/pulsegrid/backend/pkg/security"
	"github.com/pulsegrid/backend/pkg/validator"
)

type MonitorService struct {
	monitorRepo          repository.MonitorRepository
	checkResultRepo      repository.CheckResultRepository
	allowPrivateNetworks bool
}

func NewMonitorService(
	monitorRepo repository.MonitorRepository,
	checkResultRepo repository.CheckResultRepository,
	allowPrivateNetworks bool,
) *MonitorService {
	return &MonitorService{
		monitorRepo:          monitorRepo,
		checkResultRepo:      checkResultRepo,
		allowPrivateNetworks: allowPrivateNetworks,
	}
}

func (s *MonitorService) Create(ctx context.Context, userID uuid.UUID, input domain.MonitorCreateInput) (*domain.Monitor, error) {
	if valErrs := validator.ValidateMonitorInput(input); len(valErrs) > 0 {
		return nil, domain.NewValidationError("invalid monitor configuration", valErrs)
	}

	if _, err := security.ValidateTargetURL(input.URL, s.allowPrivateNetworks); err != nil {
		return nil, domain.NewValidationError("target URL is disallowed", map[string]string{
			"url": err.Error(),
		})
	}

	method := strings.ToUpper(strings.TrimSpace(input.Method))
	if method == "" {
		method = "GET"
	}

	expectedStatus := input.ExpectedStatus
	if expectedStatus == 0 {
		expectedStatus = 200
	}

	interval := input.IntervalSeconds
	if interval <= 0 {
		interval = 60
	}

	timeout := input.TimeoutMS
	if timeout <= 0 {
		timeout = 5000
	}

	headers := input.Headers
	if headers == nil {
		headers = make(map[string]string)
	}

	monitor := &domain.Monitor{
		ID:                  uuid.New(),
		UserID:              userID,
		Name:                strings.TrimSpace(input.Name),
		URL:                 strings.TrimSpace(input.URL),
		Method:              method,
		Headers:             headers,
		ExpectedStatus:      expectedStatus,
		IntervalSeconds:     interval,
		TimeoutMS:           timeout,
		Status:              domain.StatusPending,
		ConsecutiveFailures: 0,
		IsActive:            true,
	}

	if err := s.monitorRepo.Create(ctx, monitor); err != nil {
		return nil, fmt.Errorf("create monitor: %w", err)
	}

	return monitor, nil
}

func (s *MonitorService) Get(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.MonitorWithStats, []domain.LatencyBucket, error) {
	monitor, err := s.monitorRepo.GetByIDWithStats(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	if monitor.UserID != userID {
		return nil, nil, domain.NewForbiddenError("access denied to this monitor")
	}

	metrics, err := s.monitorRepo.GetAggregatedMetrics(ctx, id, 24)
	if err != nil {
		return nil, nil, fmt.Errorf("get aggregated metrics: %w", err)
	}

	return monitor, metrics, nil
}

func (s *MonitorService) List(ctx context.Context, userID uuid.UUID) ([]domain.MonitorWithStats, error) {
	return s.monitorRepo.ListByUserID(ctx, userID)
}

func (s *MonitorService) Update(ctx context.Context, id uuid.UUID, userID uuid.UUID, input domain.MonitorUpdateInput) (*domain.Monitor, error) {
	monitor, err := s.monitorRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if monitor.UserID != userID {
		return nil, domain.NewForbiddenError("access denied to this monitor")
	}

	if input.URL != nil {
		if _, err := security.ValidateTargetURL(*input.URL, s.allowPrivateNetworks); err != nil {
			return nil, domain.NewValidationError("target URL is disallowed", map[string]string{
				"url": err.Error(),
			})
		}
		monitor.URL = strings.TrimSpace(*input.URL)
	}

	if input.Name != nil && strings.TrimSpace(*input.Name) != "" {
		monitor.Name = strings.TrimSpace(*input.Name)
	}

	if input.Method != nil {
		m := strings.ToUpper(strings.TrimSpace(*input.Method))
		if m != "GET" && m != "POST" && m != "HEAD" {
			return nil, domain.NewValidationError("invalid method", map[string]string{
				"method": "must be GET, POST, or HEAD",
			})
		}
		monitor.Method = m
	}

	if input.Headers != nil {
		monitor.Headers = *input.Headers
	}

	if input.ExpectedStatus != nil {
		if *input.ExpectedStatus < 100 || *input.ExpectedStatus > 599 {
			return nil, domain.NewValidationError("invalid expected_status", map[string]string{
				"expected_status": "must be between 100 and 599",
			})
		}
		monitor.ExpectedStatus = *input.ExpectedStatus
	}

	if input.IntervalSeconds != nil {
		if *input.IntervalSeconds < 5 || *input.IntervalSeconds > 86400 {
			return nil, domain.NewValidationError("invalid interval_seconds", map[string]string{
				"interval_seconds": "must be between 5 and 86400",
			})
		}
		monitor.IntervalSeconds = *input.IntervalSeconds
	}

	if input.TimeoutMS != nil {
		if *input.TimeoutMS < 500 || *input.TimeoutMS > 60000 {
			return nil, domain.NewValidationError("invalid timeout_ms", map[string]string{
				"timeout_ms": "must be between 500 and 60000",
			})
		}
		monitor.TimeoutMS = *input.TimeoutMS
	}

	if input.IsActive != nil {
		monitor.IsActive = *input.IsActive
		if !monitor.IsActive {
			monitor.Status = domain.StatusPaused
		} else if monitor.Status == domain.StatusPaused {
			monitor.Status = domain.StatusPending
		}
	}

	monitor.UpdatedAt = time.Now()
	if err := s.monitorRepo.Update(ctx, monitor); err != nil {
		return nil, fmt.Errorf("update monitor: %w", err)
	}

	return monitor, nil
}

func (s *MonitorService) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return s.monitorRepo.Delete(ctx, id, userID)
}

func (s *MonitorService) ListChecks(ctx context.Context, monitorID uuid.UUID, userID uuid.UUID, limit, offset int) ([]domain.CheckResult, error) {
	monitor, err := s.monitorRepo.GetByID(ctx, monitorID)
	if err != nil {
		return nil, err
	}

	if monitor.UserID != userID {
		return nil, domain.NewForbiddenError("access denied to this monitor")
	}

	return s.checkResultRepo.ListByMonitorID(ctx, monitorID, limit, offset)
}

func (s *MonitorService) GetPublicStatus(ctx context.Context) ([]domain.MonitorWithStats, error) {
	return s.monitorRepo.GetPublicSummary(ctx)
}
