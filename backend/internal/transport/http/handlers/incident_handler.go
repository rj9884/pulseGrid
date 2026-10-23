package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/service"
)

type IncidentHandler struct {
	incidentService *service.IncidentService
}

func NewIncidentHandler(incidentService *service.IncidentService) *IncidentHandler {
	return &IncidentHandler{incidentService: incidentService}
}

func (h *IncidentHandler) ListIncidents(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value("user_id")
	var userFilter *uuid.UUID
	if id, ok := userIDVal.(uuid.UUID); ok {
		userFilter = &id
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	incidents, err := h.incidentService.ListIncidents(r.Context(), userFilter, limit, offset)
	if err != nil {
		RespondError(w, err)
		return
	}

	if incidents == nil {
		incidents = []domain.Incident{}
	}

	RespondJSON(w, http.StatusOK, incidents)
}

func (h *IncidentHandler) ListAlertChannels(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	channels, err := h.incidentService.ListAlertChannels(r.Context(), userID)
	if err != nil {
		RespondError(w, err)
		return
	}

	if channels == nil {
		channels = []domain.AlertChannel{}
	}

	RespondJSON(w, http.StatusOK, channels)
}

func (h *IncidentHandler) CreateAlertChannel(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	var input domain.AlertChannelCreateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, domain.NewValidationError("invalid json request payload", nil))
		return
	}

	channel, err := h.incidentService.CreateAlertChannel(r.Context(), userID, input)
	if err != nil {
		RespondError(w, err)
		return
	}

	RespondJSON(w, http.StatusCreated, channel)
}

func (h *IncidentHandler) DeleteAlertChannel(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, domain.NewValidationError("invalid alert channel uuid", nil))
		return
	}

	if err := h.incidentService.DeleteAlertChannel(r.Context(), id, userID); err != nil {
		RespondError(w, err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "alert channel deleted successfully"})
}
