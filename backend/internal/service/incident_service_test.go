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

type MockIncidentRepo struct {
	mock.Mock
}

func (m *MockIncidentRepo) Create(ctx context.Context, incident *domain.Incident) error {
	args := m.Called(ctx, incident)
	return args.Error(0)
}

func (m *MockIncidentRepo) GetOpenByMonitorID(ctx context.Context, monitorID uuid.UUID) (*domain.Incident, error) {
	args := m.Called(ctx, monitorID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Incident), args.Error(1)
}

func (m *MockIncidentRepo) Resolve(ctx context.Context, id uuid.UUID, resolvedAt time.Time) error {
	args := m.Called(ctx, id, resolvedAt)
	return args.Error(0)
}

func (m *MockIncidentRepo) List(ctx context.Context, userID *uuid.UUID, limit, offset int) ([]domain.Incident, error) {
	args := m.Called(ctx, userID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.Incident), args.Error(1)
}

type MockAlertChannelRepo struct {
	mock.Mock
}

func (m *MockAlertChannelRepo) Create(ctx context.Context, ch *domain.AlertChannel) error {
	args := m.Called(ctx, ch)
	return args.Error(0)
}

func (m *MockAlertChannelRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.AlertChannel, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.AlertChannel), args.Error(1)
}

func (m *MockAlertChannelRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func TestIncidentService_AlertChannels(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("creates alert channel successfully", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo)

		alertRepo.On("Create", ctx, mock.AnythingOfType("*domain.AlertChannel")).Return(nil)

		ch, err := svc.CreateAlertChannel(ctx, userID, domain.AlertChannelCreateInput{
			Name:       "Slack Alerts",
			WebhookURL: "https://hooks.slack.com/services/test",
		})

		require.NoError(t, err)
		assert.Equal(t, "Slack Alerts", ch.Name)
		assert.True(t, ch.IsEnabled)
		alertRepo.AssertExpectations(t)
	})

	t.Run("rejects invalid webhook url", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo)

		ch, err := svc.CreateAlertChannel(ctx, userID, domain.AlertChannelCreateInput{
			Name:       "Bad Webhook",
			WebhookURL: "ftp://invalid-url",
		})

		assert.Error(t, err)
		assert.Nil(t, ch)
	})
}
