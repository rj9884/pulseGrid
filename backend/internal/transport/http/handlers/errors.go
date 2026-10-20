package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/pulsegrid/backend/internal/domain"
)

func RespondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func RespondError(w http.ResponseWriter, err error) {
	var appErr *domain.AppError
	if errors.As(err, &appErr) {
		status := appErr.StatusCode
		if status == 0 {
			status = http.StatusInternalServerError
		}

		problem := domain.ProblemDetails{
			Type:   "https://tools.ietf.org/html/rfc7807",
			Title:  http.StatusText(status),
			Status: status,
			Detail: appErr.Message,
			Errors: appErr.Validation,
		}

		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(problem)
		return
	}

	if errors.Is(err, domain.ErrNotFound) {
		RespondError(w, domain.NewNotFoundError("resource"))
		return
	}
	if errors.Is(err, domain.ErrUnauthorized) {
		RespondError(w, domain.NewUnauthorizedError("unauthorized access"))
		return
	}
	if errors.Is(err, domain.ErrForbidden) {
		RespondError(w, domain.NewForbiddenError("action forbidden"))
		return
	}
	if errors.Is(err, domain.ErrConflict) {
		RespondError(w, domain.NewConflictError("resource conflict"))
		return
	}

	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(http.StatusInternalServerError)
	_ = json.NewEncoder(w).Encode(domain.ProblemDetails{
		Type:   "https://tools.ietf.org/html/rfc7807",
		Title:  http.StatusText(http.StatusInternalServerError),
		Status: http.StatusInternalServerError,
		Detail: "an unexpected error occurred",
	})
}
