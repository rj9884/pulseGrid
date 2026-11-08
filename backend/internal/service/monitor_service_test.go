package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type MockMonitorRepo struct {
	mock.Mock
}

func (m *MockMonitorRepo) Create(ctx context.Context, monitor *domain.Monitor) error {
	args := m.Called(ctx, monitor)
	return args.Error(0)
}

func (m *MockMonitorRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Monitor, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Monitor), args.Error(1)
}

func (m *MockMonitorRepo) GetByIDWithStats(ctx context.Context, id uuid.UUID) (*domain.MonitorWithStats, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.MonitorWithStats), args.Error(1)
}

func (m *MockMonitorRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.MonitorWithStats, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.MonitorWithStats), args.Error(1)
}

func (m *MockMonitorRepo) FetchDueMonitors(ctx context.Context, limit int) ([]domain.MonitorJob, error) {
	args := m.Called(ctx, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.MonitorJob), args.Error(1)
}

func (m *MockMonitorRepo) Update(ctx context.Context, monitor *domain.Monitor) error {
	args := m.Called(ctx, monitor)
	return args.Error(0)
}

func (m *MockMonitorRepo) UpdateState(ctx context.Context, id uuid.UUID, status domain.MonitorStatus, consecutiveFailures int, lastCheckedAt time.Time) error {
	args := m.Called(ctx, id, status, consecutiveFailures, lastCheckedAt)
	return args.Error(0)
}

func (m *MockMonitorRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *MockMonitorRepo) GetAggregatedMetrics(ctx context.Context, monitorID uuid.UUID, hours int) ([]domain.LatencyBucket, error) {
	args := m.Called(ctx, monitorID, hours)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.LatencyBucket), args.Error(1)
}

func (m *MockMonitorRepo) GetPublicSummary(ctx context.Context) ([]domain.MonitorWithStats, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.MonitorWithStats), args.Error(1)
}

type MockCheckResultRepo struct {
	mock.Mock
}

func (m *MockCheckResultRepo) Create(ctx context.Context, result *domain.CheckResult) error {
	args := m.Called(ctx, result)
	return args.Error(0)
}

func (m *MockCheckResultRepo) ListByMonitorID(ctx context.Context, monitorID uuid.UUID, limit, offset int) ([]domain.CheckResult, error) {
	args := m.Called(ctx, monitorID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.CheckResult), args.Error(1)
}

func (m *MockCheckResultRepo) PurgeOlderThan(ctx context.Context, age time.Duration) (int64, error) {
	args := m.Called(ctx, age)
	return args.Get(0).(int64), args.Error(1)
}

func TestMonitorService_Create(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("creates monitor successfully", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		input := domain.MonitorCreateInput{
			Name:            "Primary Gateway",
			URL:             "http://127.0.0.1:8080/health",
			Method:          "GET",
			ExpectedStatus:  200,
			IntervalSeconds: 60,
			TimeoutMS:       5000,
		}

		mRepo.On("Create", ctx, mock.AnythingOfType("*domain.Monitor")).Return(nil)

		mon, err := svc.Create(ctx, userID, input)
		require.NoError(t, err)
		assert.Equal(t, "Primary Gateway", mon.Name)
		assert.Equal(t, domain.StatusPending, mon.Status)
		assert.True(t, mon.IsActive)
		mRepo.AssertExpectations(t)
	})

	t.Run("rejects private network when allowPrivate is false", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, false)

		input := domain.MonitorCreateInput{
			Name: "Internal Gateway",
			URL:  "http://127.0.0.1:8080/health",
		}

		mon, err := svc.Create(ctx, userID, input)
		assert.Error(t, err)
		assert.Nil(t, mon)
	})
}

func TestMonitorService_GetForbidden(t *testing.T) {
	ctx := context.Background()
	ownerID := uuid.New()
	otherUserID := uuid.New()
	monitorID := uuid.New()

	mRepo := new(MockMonitorRepo)
	cRepo := new(MockCheckResultRepo)
	svc := NewMonitorService(mRepo, cRepo, true)

	mRepo.On("GetByIDWithStats", ctx, monitorID).Return(&domain.MonitorWithStats{
		Monitor: domain.Monitor{
			ID:     monitorID,
			UserID: ownerID,
			Name:   "Private Monitor",
		},
	}, nil)

	mon, metrics, err := svc.Get(ctx, monitorID, otherUserID)
	assert.Error(t, err)
	assert.Nil(t, mon)
	assert.Nil(t, metrics)
}
