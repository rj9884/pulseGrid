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
		svc := NewIncidentService(incRepo, alertRepo, true)

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
		svc := NewIncidentService(incRepo, alertRepo, false)

		ch, err := svc.CreateAlertChannel(ctx, userID, domain.AlertChannelCreateInput{
			Name:       "Bad Webhook",
			WebhookURL: "ftp://invalid-url",
		})

		assert.Error(t, err)
		assert.Nil(t, ch)
	})

	t.Run("creates alert channel with IsEnabled false", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		alertRepo.On("Create", ctx, mock.AnythingOfType("*domain.AlertChannel")).Return(nil)

		disabled := false
		ch, err := svc.CreateAlertChannel(ctx, userID, domain.AlertChannelCreateInput{
			Name:        "Discord Alerts",
			WebhookURL:  "https://discord.com/api/webhooks/test",
			IsEnabled:   &disabled,
		})

		require.NoError(t, err)
		assert.Equal(t, "Discord Alerts", ch.Name)
		assert.False(t, ch.IsEnabled)
		alertRepo.AssertExpectations(t)
	})

	t.Run("rejects private network when allowPrivate is false", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, false)

		ch, err := svc.CreateAlertChannel(ctx, userID, domain.AlertChannelCreateInput{
			Name:       "Internal Webhook",
			WebhookURL: "http://10.0.0.1:9000/webhook",
		})

		assert.Error(t, err)
		assert.Nil(t, ch)
	})
}

func TestIncidentService_ListIncidents(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("returns list of incidents", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		expected := []domain.Incident{
			{ID: uuid.New(), MonitorID: uuid.New(), Status: domain.IncidentOpen},
			{ID: uuid.New(), MonitorID: uuid.New(), Status: domain.IncidentResolved},
		}

		incRepo.On("List", ctx, &userID, 10, 0).Return(expected, nil)

		incidents, err := svc.ListIncidents(ctx, &userID, 10, 0)
		require.NoError(t, err)
		assert.Len(t, incidents, 2)
		incRepo.AssertExpectations(t)
	})

	t.Run("returns all incidents when userID is nil", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		expected := []domain.Incident{
			{ID: uuid.New(), MonitorID: uuid.New(), Status: domain.IncidentOpen},
		}

		incRepo.On("List", ctx, (*uuid.UUID)(nil), 10, 0).Return(expected, nil)

		incidents, err := svc.ListIncidents(ctx, nil, 10, 0)
		require.NoError(t, err)
		assert.Len(t, incidents, 1)
		incRepo.AssertExpectations(t)
	})

	t.Run("returns empty list when none exist", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		incRepo.On("List", ctx, &userID, 10, 0).Return([]domain.Incident{}, nil)

		incidents, err := svc.ListIncidents(ctx, &userID, 10, 0)
		require.NoError(t, err)
		assert.Empty(t, incidents)
	})
}

func TestIncidentService_ListAlertChannels(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("returns list of alert channels", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		expected := []domain.AlertChannel{
			{ID: uuid.New(), UserID: userID, Name: "Slack", IsEnabled: true},
			{ID: uuid.New(), UserID: userID, Name: "Discord", IsEnabled: false},
		}

		alertRepo.On("ListByUserID", ctx, userID).Return(expected, nil)

		channels, err := svc.ListAlertChannels(ctx, userID)
		require.NoError(t, err)
		assert.Len(t, channels, 2)
		assert.True(t, channels[0].IsEnabled)
		assert.False(t, channels[1].IsEnabled)
		alertRepo.AssertExpectations(t)
	})

	t.Run("returns empty list when none exist", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		alertRepo.On("ListByUserID", ctx, userID).Return([]domain.AlertChannel{}, nil)

		channels, err := svc.ListAlertChannels(ctx, userID)
		require.NoError(t, err)
		assert.Empty(t, channels)
	})
}

func TestIncidentService_DeleteAlertChannel(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	channelID := uuid.New()

	t.Run("deletes alert channel successfully", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		alertRepo.On("Delete", ctx, channelID, userID).Return(nil)

		err := svc.DeleteAlertChannel(ctx, channelID, userID)
		assert.NoError(t, err)
		alertRepo.AssertExpectations(t)
	})

	t.Run("propagates repository error", func(t *testing.T) {
		incRepo := new(MockIncidentRepo)
		alertRepo := new(MockAlertChannelRepo)
		svc := NewIncidentService(incRepo, alertRepo, true)

		alertRepo.On("Delete", ctx, channelID, userID).Return(domain.ErrNotFound)

		err := svc.DeleteAlertChannel(ctx, channelID, userID)
		assert.Error(t, err)
	})
}
