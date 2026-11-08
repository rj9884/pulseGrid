package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/transport/http/handlers"
	"github.com/pulsegrid/backend/pkg/auth"
)

type contextKey = handlers.ContextKey

const (
	UserIDContextKey = handlers.UserIDContextKey
	RoleContextKey   = handlers.RoleContextKey
)

func Auth(jwtManager *auth.JWTManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				handlers.RespondError(w, domain.NewUnauthorizedError("authorization header missing"))
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				handlers.RespondError(w, domain.NewUnauthorizedError("invalid authorization format, expected Bearer <token>"))
				return
			}

			claims, err := jwtManager.ValidateAccessToken(parts[1])
			if err != nil {
				handlers.RespondError(w, domain.NewUnauthorizedError("invalid or expired token"))
				return
			}

			ctx := handlers.WithUserContext(r.Context(), claims.UserID, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(requiredRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := handlers.GetRole(r.Context())
			if !ok || role != requiredRole {
				handlers.RespondError(w, domain.NewForbiddenError("insufficient permissions for this action"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	return handlers.GetUserID(ctx)
}

func GetRole(ctx context.Context) (string, bool) {
	return handlers.GetRole(ctx)
}
