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

type contextKey string

const (
	UserIDContextKey contextKey = "user_id"
	RoleContextKey   contextKey = "role"
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

			ctx := context.WithValue(r.Context(), UserIDContextKey, claims.UserID)
			ctx = context.WithValue(ctx, RoleContextKey, claims.Role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(requiredRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(RoleContextKey).(string)
			if !ok || role != requiredRole {
				handlers.RespondError(w, domain.NewForbiddenError("insufficient permissions for this action"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	val := ctx.Value(UserIDContextKey)
	id, ok := val.(uuid.UUID)
	return id, ok
}

func GetRole(ctx context.Context) (string, bool) {
	val := ctx.Value(RoleContextKey)
	role, ok := val.(string)
	return role, ok
}
