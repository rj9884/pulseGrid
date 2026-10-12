package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJWTManager(t *testing.T) {
	jwtManager := NewJWTManager("access-secret-32-bytes-secure-string", "refresh-secret-32-bytes-secure-str", 15*time.Minute, 7*24*time.Hour)
	userID := uuid.New()
	role := "ADMIN"

	t.Run("Generate and validate valid access token", func(t *testing.T) {
		token, err := jwtManager.GenerateAccessToken(userID, role)
		require.NoError(t, err)
		assert.NotEmpty(t, token)

		claims, err := jwtManager.ValidateAccessToken(token)
		require.NoError(t, err)
		assert.Equal(t, userID, claims.UserID)
		assert.Equal(t, role, claims.Role)
	})

	t.Run("Generate and validate valid refresh token", func(t *testing.T) {
		token, err := jwtManager.GenerateRefreshToken(userID, role)
		require.NoError(t, err)
		assert.NotEmpty(t, token)

		claims, err := jwtManager.ValidateRefreshToken(token)
		require.NoError(t, err)
		assert.Equal(t, userID, claims.UserID)
		assert.Equal(t, role, claims.Role)
	})

	t.Run("Reject expired access token", func(t *testing.T) {
		expiredManager := NewJWTManager("access-secret-32-bytes-secure-string", "refresh-secret-32-bytes-secure-str", -1*time.Minute, 1*time.Hour)
		token, err := expiredManager.GenerateAccessToken(userID, role)
		require.NoError(t, err)

		_, err = jwtManager.ValidateAccessToken(token)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "expired")
	})

	t.Run("Reject invalid signature", func(t *testing.T) {
		otherManager := NewJWTManager("different-secret-for-testing-purposes", "different-refresh-secret-purposes", 15*time.Minute, 1*time.Hour)
		token, err := otherManager.GenerateAccessToken(userID, role)
		require.NoError(t, err)

		_, err = jwtManager.ValidateAccessToken(token)
		assert.Error(t, err)
	})
}

func TestPasswordHashing(t *testing.T) {
	password := "SecretPass123!"

	hash, err := HashPassword(password)
	require.NoError(t, err)
	assert.NotEmpty(t, hash)

	assert.True(t, CheckPassword(password, hash))
	assert.False(t, CheckPassword("WrongPassword", hash))
}
