package handlers

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestContextHelpers(t *testing.T) {
	ctx := context.Background()

	// Empty context
	id, ok := GetUserID(ctx)
	assert.False(t, ok)
	assert.Equal(t, uuid.Nil, id)

	role, ok := GetRole(ctx)
	assert.False(t, ok)
	assert.Empty(t, role)

	// Context with User context set via WithUserContext
	userID := uuid.New()
	userRole := "ADMIN"
	ctxWithUser := WithUserContext(ctx, userID, userRole)

	id, ok = GetUserID(ctxWithUser)
	assert.True(t, ok)
	assert.Equal(t, userID, id)

	role, ok = GetRole(ctxWithUser)
	assert.True(t, ok)
	assert.Equal(t, userRole, role)

	// Context with raw string key fallback
	rawStringCtx := context.WithValue(ctx, "user_id", userID)
	rawStringCtx = context.WithValue(rawStringCtx, "role", userRole)

	id, ok = GetUserID(rawStringCtx)
	assert.True(t, ok)
	assert.Equal(t, userID, id)

	role, ok = GetRole(rawStringCtx)
	assert.True(t, ok)
	assert.Equal(t, userRole, role)
}
