package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/transport/http/handlers"
	"github.com/pulsegrid/backend/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthMiddleware_ContextPropagation(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-access-secret-32-chars-long!", "test-refresh-secret-32-chars-long", 15*time.Minute, 7*24*time.Hour)
	userID := uuid.New()
	token, err := jwtManager.GenerateAccessToken(userID, "ADMIN")
	require.NoError(t, err)

	var extractedUserID uuid.UUID
	var extractedRole string
	var extractedOk bool

	handler := Auth(jwtManager)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		extractedUserID, extractedOk = handlers.GetUserID(r.Context())
		extractedRole, _ = handlers.GetRole(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/monitors", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, extractedOk)
	assert.Equal(t, userID, extractedUserID)
	assert.Equal(t, "ADMIN", extractedRole)
}

func TestResponseWriter_FlusherSupport(t *testing.T) {
	rec := httptest.NewRecorder()
	wrapped := &responseWriter{ResponseWriter: rec, statusCode: http.StatusOK}

	flusher, ok := any(wrapped).(http.Flusher)
	assert.True(t, ok, "responseWriter must implement http.Flusher")
	if ok {
		flusher.Flush()
		assert.True(t, rec.Flushed)
	}
}
