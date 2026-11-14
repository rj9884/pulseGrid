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

type IncidentService struct {
	incidentRepo         repository.IncidentRepository
	alertChannelRepo     repository.AlertChannelRepository
	allowPrivateNetworks bool
}

func NewIncidentService(
	incidentRepo repository.IncidentRepository,
	alertChannelRepo repository.AlertChannelRepository,
	allowPrivateNetworks bool,
) *IncidentService {
	return &IncidentService{
		incidentRepo:         incidentRepo,
		alertChannelRepo:     alertChannelRepo,
		allowPrivateNetworks: allowPrivateNetworks,
	}
}

func (s *IncidentService) ListIncidents(ctx context.Context, userID *uuid.UUID, limit, offset int) ([]domain.Incident, error) {
	return s.incidentRepo.List(ctx, userID, limit, offset)
}

func (s *IncidentService) CreateAlertChannel(ctx context.Context, userID uuid.UUID, input domain.AlertChannelCreateInput) (*domain.AlertChannel, error) {
	if valErrs := validator.ValidateAlertChannelInput(input); len(valErrs) > 0 {
		return nil, domain.NewValidationError("invalid alert channel configuration", valErrs)
	}

	// SSRF prevention: Validate webhook URL against private/internal networks
	if _, err := security.ValidateTargetURL(input.WebhookURL, s.allowPrivateNetworks); err != nil {
		return nil, domain.NewValidationError("webhook URL is disallowed", map[string]string{
			"webhook_url": err.Error(),
		})
	}

	isEnabled := true
	if input.IsEnabled != nil {
		isEnabled = *input.IsEnabled
	}

	channel := &domain.AlertChannel{
		ID:         uuid.New(),
		UserID:     userID,
		Name:       strings.TrimSpace(input.Name),
		WebhookURL: strings.TrimSpace(input.WebhookURL),
		IsEnabled:  isEnabled,
		CreatedAt:  time.Now(),
	}

	if err := s.alertChannelRepo.Create(ctx, channel); err != nil {
		return nil, fmt.Errorf("create alert channel: %w", err)
	}

	return channel, nil
}

func (s *IncidentService) ListAlertChannels(ctx context.Context, userID uuid.UUID) ([]domain.AlertChannel, error) {
	return s.alertChannelRepo.ListByUserID(ctx, userID)
}

func (s *IncidentService) DeleteAlertChannel(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return s.alertChannelRepo.Delete(ctx, id, userID)
}
