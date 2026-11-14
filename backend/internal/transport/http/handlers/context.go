package handlers

import (
	"context"

	"github.com/google/uuid"
)

type ContextKey string

const (
	UserIDContextKey ContextKey = "user_id"
	RoleContextKey   ContextKey = "role"
)

func WithUserContext(ctx context.Context, userID uuid.UUID, role string) context.Context {
	ctx = context.WithValue(ctx, UserIDContextKey, userID)
	ctx = context.WithValue(ctx, RoleContextKey, role)
	ctx = context.WithValue(ctx, "user_id", userID)
	ctx = context.WithValue(ctx, "role", role)
	return ctx
}

func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	if val := ctx.Value(UserIDContextKey); val != nil {
		if id, ok := val.(uuid.UUID); ok {
			return id, true
		}
	}
	if val := ctx.Value("user_id"); val != nil {
		if id, ok := val.(uuid.UUID); ok {
			return id, true
		}
	}
	return uuid.Nil, false
}

func GetRole(ctx context.Context) (string, bool) {
	if val := ctx.Value(RoleContextKey); val != nil {
		if role, ok := val.(string); ok {
			return role, true
		}
	}
	if val := ctx.Value("role"); val != nil {
		if role, ok := val.(string); ok {
			return role, true
		}
	}
	return "", false
}

// GetUserRole returns the user role from context, or empty string if not found.
// This is a convenience wrapper for handlers that need role-based checks.
func GetUserRole(ctx context.Context) string {
	role, _ := GetRole(ctx)
	return role
}
