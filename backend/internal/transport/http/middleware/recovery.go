package middleware

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/pkg/logger"
)

func Recovery(base *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rvr := recover(); rvr != nil {
					reqLogger := logger.FromContext(r.Context(), base)
					reqLogger.Error("panic recovered",
						"error", fmt.Sprintf("%v", rvr),
						"stack", string(debug.Stack()),
					)

					w.Header().Set("Content-Type", "application/problem+json")
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(domain.ProblemDetails{
						Type:   "https://tools.ietf.org/html/rfc7807",
						Title:  "Internal Server Error",
						Status: http.StatusInternalServerError,
						Detail: "an unexpected error occurred",
					})
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}
