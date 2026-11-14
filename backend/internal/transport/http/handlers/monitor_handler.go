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

type MonitorHandler struct {
	monitorService *service.MonitorService
}

func NewMonitorHandler(monitorService *service.MonitorService) *MonitorHandler {
	return &MonitorHandler{monitorService: monitorService}
}

func (h *MonitorHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserID(r.Context())
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	monitors, err := h.monitorService.List(r.Context(), userID)
	if err != nil {
		RespondError(w, err)
		return
	}

	if monitors == nil {
		monitors = []domain.MonitorWithStats{}
	}

	RespondJSON(w, http.StatusOK, monitors)
}

func (h *MonitorHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserID(r.Context())
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	// RBAC: Only ADMIN can create monitors
	userRole := GetUserRole(r.Context())
	if userRole != domain.RoleAdmin {
		RespondError(w, domain.NewForbiddenError("admin role required to create monitors"))
		return
	}

	var input domain.MonitorCreateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, domain.NewValidationError("invalid json request payload", nil))
		return
	}

	monitor, err := h.monitorService.Create(r.Context(), userID, input)
	if err != nil {
		RespondError(w, err)
		return
	}

	RespondJSON(w, http.StatusCreated, monitor)
}

func (h *MonitorHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserID(r.Context())
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, domain.NewValidationError("invalid monitor uuid", nil))
		return
	}

	monitor, metrics, err := h.monitorService.Get(r.Context(), id, userID)
	if err != nil {
		RespondError(w, err)
		return
	}

	if metrics == nil {
		metrics = []domain.LatencyBucket{}
	}

	RespondJSON(w, http.StatusOK, map[string]any{
		"monitor": monitor,
		"metrics": metrics,
	})
}

func (h *MonitorHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserID(r.Context())
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	// RBAC: Only ADMIN can update monitors
	userRole := GetUserRole(r.Context())
	if userRole != domain.RoleAdmin {
		RespondError(w, domain.NewForbiddenError("admin role required to update monitors"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, domain.NewValidationError("invalid monitor uuid", nil))
		return
	}

	var input domain.MonitorUpdateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, domain.NewValidationError("invalid json request payload", nil))
		return
	}

	monitor, err := h.monitorService.Update(r.Context(), id, userID, input)
	if err != nil {
		RespondError(w, err)
		return
	}

	RespondJSON(w, http.StatusOK, monitor)
}

func (h *MonitorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserID(r.Context())
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	// RBAC: Only ADMIN can delete monitors
	userRole := GetUserRole(r.Context())
	if userRole != domain.RoleAdmin {
		RespondError(w, domain.NewForbiddenError("admin role required to delete monitors"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, domain.NewValidationError("invalid monitor uuid", nil))
		return
	}

	if err := h.monitorService.Delete(r.Context(), id, userID); err != nil {
		RespondError(w, err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "monitor deleted successfully"})
}

func (h *MonitorHandler) ListChecks(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserID(r.Context())
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, domain.NewValidationError("invalid monitor uuid", nil))
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	checks, err := h.monitorService.ListChecks(r.Context(), id, userID, limit, offset)
	if err != nil {
		RespondError(w, err)
		return
	}

	if checks == nil {
		checks = []domain.CheckResult{}
	}

	RespondJSON(w, http.StatusOK, checks)
}

func (h *MonitorHandler) PublicStatus(w http.ResponseWriter, r *http.Request) {
	summary, err := h.monitorService.GetPublicStatus(r.Context())
	if err != nil {
		RespondError(w, err)
		return
	}

	if summary == nil {
		summary = []domain.MonitorWithStats{}
	}

	var totalUp, totalDown int
	for _, m := range summary {
		if m.Status == domain.StatusUp {
			totalUp++
		} else if m.Status == domain.StatusDown {
			totalDown++
		}
	}

	systemStatus := "OPERATIONAL"
	if totalDown > 0 && totalUp > 0 {
		systemStatus = "DEGRADED"
	} else if totalDown > 0 && totalUp == 0 {
		systemStatus = "MAJOR_OUTAGE"
	}

	RespondJSON(w, http.StatusOK, map[string]any{
		"system_status": systemStatus,
		"total_monitors": len(summary),
		"monitors_up":    totalUp,
		"monitors_down":  totalDown,
		"monitors":       summary,
	})
}
