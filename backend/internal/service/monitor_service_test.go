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

func (m *MockMonitorRepo) MarkMonitorsChecked(ctx context.Context, monitorIDs []uuid.UUID, checkedAt time.Time) error {
	args := m.Called(ctx, monitorIDs, checkedAt)
	return args.Error(0)
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

func TestMonitorService_List(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("returns list of monitors", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		expected := []domain.MonitorWithStats{
			{Monitor: domain.Monitor{ID: uuid.New(), UserID: userID, Name: "Monitor 1"}},
			{Monitor: domain.Monitor{ID: uuid.New(), UserID: userID, Name: "Monitor 2"}},
		}

		mRepo.On("ListByUserID", ctx, userID).Return(expected, nil)

		monitors, err := svc.List(ctx, userID)
		require.NoError(t, err)
		assert.Len(t, monitors, 2)
		mRepo.AssertExpectations(t)
	})

	t.Run("returns empty list when none exist", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		mRepo.On("ListByUserID", ctx, userID).Return([]domain.MonitorWithStats{}, nil)

		monitors, err := svc.List(ctx, userID)
		require.NoError(t, err)
		assert.Empty(t, monitors)
	})

	t.Run("propagates repository error", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		mRepo.On("ListByUserID", ctx, userID).Return(nil, domain.ErrNotFound)

		monitors, err := svc.List(ctx, userID)
		assert.Error(t, err)
		assert.Nil(t, monitors)
	})
}

func TestMonitorService_Update(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	monitorID := uuid.New()

	t.Run("updates monitor successfully", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		existing := &domain.Monitor{
			ID:              monitorID,
			UserID:          userID,
			Name:            "Old Name",
			URL:             "https://example.com/health",
			Method:          "GET",
			ExpectedStatus:  200,
			IntervalSeconds: 60,
			TimeoutMS:       5000,
			Status:          domain.StatusUp,
			IsActive:        true,
		}

		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)
		mRepo.On("Update", ctx, mock.AnythingOfType("*domain.Monitor")).Return(nil)

		newName := "Updated Name"
		newURL := "https://api.example.com/health"
		newInterval := 120
		monitor, err := svc.Update(ctx, monitorID, userID, domain.MonitorUpdateInput{
			Name:            &newName,
			URL:             &newURL,
			IntervalSeconds: &newInterval,
		})

		require.NoError(t, err)
		assert.Equal(t, "Updated Name", monitor.Name)
		assert.Equal(t, "https://api.example.com/health", monitor.URL)
		assert.Equal(t, 120, monitor.IntervalSeconds)
		mRepo.AssertExpectations(t)
	})

	t.Run("rejects update from another user", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		otherUserID := uuid.New()
		mRepo.On("GetByID", ctx, monitorID).Return(&domain.Monitor{
			ID:     monitorID,
			UserID: otherUserID,
			Name:   "Private",
		}, nil)

		monitor, err := svc.Update(ctx, monitorID, userID, domain.MonitorUpdateInput{
			Name: func() *string { s := "New"; return &s }(),
		})

		assert.Error(t, err)
		assert.Nil(t, monitor)
	})

	t.Run("validates URL on update", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, false)

		existing := &domain.Monitor{
			ID:     monitorID,
			UserID: userID,
			Name:   "Monitor",
			URL:    "https://example.com",
		}

		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)

		invalidURL := "http://127.0.0.1:8080"
		monitor, err := svc.Update(ctx, monitorID, userID, domain.MonitorUpdateInput{
			URL: &invalidURL,
		})

		assert.Error(t, err)
		assert.Nil(t, monitor)
	})

	t.Run("validates method on update", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		existing := &domain.Monitor{
			ID:     monitorID,
			UserID: userID,
			Name:   "Monitor",
			URL:    "https://example.com",
		}

		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)

		invalidMethod := "INVALID"
		monitor, err := svc.Update(ctx, monitorID, userID, domain.MonitorUpdateInput{
			Method: &invalidMethod,
		})

		assert.Error(t, err)
		assert.Nil(t, monitor)
	})

	t.Run("validates expected status range", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		existing := &domain.Monitor{
			ID:     monitorID,
			UserID: userID,
			Name:   "Monitor",
			URL:    "https://example.com",
		}

		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)

		invalidStatus := 99
		monitor, err := svc.Update(ctx, monitorID, userID, domain.MonitorUpdateInput{
			ExpectedStatus: &invalidStatus,
		})

		assert.Error(t, err)
		assert.Nil(t, monitor)
	})

	t.Run("pauses monitor when IsActive set to false", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		existing := &domain.Monitor{
			ID:     monitorID,
			UserID: userID,
			Name:   "Monitor",
			URL:    "https://example.com",
			Status: domain.StatusUp,
			IsActive: true,
		}

		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)
		mRepo.On("Update", ctx, mock.AnythingOfType("*domain.Monitor")).Return(nil)

		inactive := false
		monitor, err := svc.Update(ctx, monitorID, userID, domain.MonitorUpdateInput{
			IsActive: &inactive,
		})

		require.NoError(t, err)
		assert.False(t, monitor.IsActive)
		assert.Equal(t, domain.StatusPaused, monitor.Status)
	})

	t.Run("resumes monitor when IsActive set to true", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		existing := &domain.Monitor{
			ID:      monitorID,
			UserID:  userID,
			Name:    "Monitor",
			URL:     "https://example.com",
			Status:  domain.StatusPaused,
			IsActive: false,
		}

		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)
		mRepo.On("Update", ctx, mock.AnythingOfType("*domain.Monitor")).Return(nil)

		active := true
		monitor, err := svc.Update(ctx, monitorID, userID, domain.MonitorUpdateInput{
			IsActive: &active,
		})

		require.NoError(t, err)
		assert.True(t, monitor.IsActive)
		assert.Equal(t, domain.StatusPending, monitor.Status)
	})
}

func TestMonitorService_Delete(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	monitorID := uuid.New()

	t.Run("deletes monitor successfully", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		mRepo.On("Delete", ctx, monitorID, userID).Return(nil)

		err := svc.Delete(ctx, monitorID, userID)
		assert.NoError(t, err)
		mRepo.AssertExpectations(t)
	})

	t.Run("propagates repository error", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		mRepo.On("Delete", ctx, monitorID, userID).Return(domain.ErrNotFound)

		err := svc.Delete(ctx, monitorID, userID)
		assert.Error(t, err)
	})
}

func TestMonitorService_ListChecks(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	monitorID := uuid.New()

	t.Run("returns check results", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		existing := &domain.Monitor{ID: monitorID, UserID: userID}
		expectedChecks := []domain.CheckResult{
			{ID: 1, MonitorID: monitorID, IsUp: true},
			{ID: 2, MonitorID: monitorID, IsUp: false},
		}

		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)
		cRepo.On("ListByMonitorID", ctx, monitorID, 10, 0).Return(expectedChecks, nil)

		checks, err := svc.ListChecks(ctx, monitorID, userID, 10, 0)
		require.NoError(t, err)
		assert.Len(t, checks, 2)
		mRepo.AssertExpectations(t)
		cRepo.AssertExpectations(t)
	})

	t.Run("rejects access from another user", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		otherUserID := uuid.New()
		mRepo.On("GetByID", ctx, monitorID).Return(&domain.Monitor{
			ID:     monitorID,
			UserID: otherUserID,
		}, nil)

		checks, err := svc.ListChecks(ctx, monitorID, userID, 10, 0)
		assert.Error(t, err)
		assert.Nil(t, checks)
	})

	t.Run("propagates repository error", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		existing := &domain.Monitor{ID: monitorID, UserID: userID}
		mRepo.On("GetByID", ctx, monitorID).Return(existing, nil)
		cRepo.On("ListByMonitorID", ctx, monitorID, 10, 0).Return(nil, domain.ErrNotFound)

		checks, err := svc.ListChecks(ctx, monitorID, userID, 10, 0)
		assert.Error(t, err)
		assert.Nil(t, checks)
	})
}

func TestMonitorService_GetPublicStatus(t *testing.T) {
	ctx := context.Background()

	t.Run("returns public monitor summary", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		expected := []domain.MonitorWithStats{
			{Monitor: domain.Monitor{ID: uuid.New(), Name: "Public 1"}},
			{Monitor: domain.Monitor{ID: uuid.New(), Name: "Public 2"}},
		}

		mRepo.On("GetPublicSummary", ctx).Return(expected, nil)

		monitors, err := svc.GetPublicStatus(ctx)
		require.NoError(t, err)
		assert.Len(t, monitors, 2)
		mRepo.AssertExpectations(t)
	})

	t.Run("propagates repository error", func(t *testing.T) {
		mRepo := new(MockMonitorRepo)
		cRepo := new(MockCheckResultRepo)
		svc := NewMonitorService(mRepo, cRepo, true)

		mRepo.On("GetPublicSummary", ctx).Return(nil, domain.ErrNotFound)

		monitors, err := svc.GetPublicStatus(ctx)
		assert.Error(t, err)
		assert.Nil(t, monitors)
	})
}
