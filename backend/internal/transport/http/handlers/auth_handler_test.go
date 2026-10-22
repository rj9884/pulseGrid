package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/service"
	"github.com/pulsegrid/backend/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type MockUserRepo struct {
	mock.Mock
}

func (m *MockUserRepo) Create(ctx context.Context, u *domain.User) error {
	args := m.Called(ctx, u)
	return args.Error(0)
}

func (m *MockUserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

type MockTokenStore struct {
	mock.Mock
}

func (m *MockTokenStore) StoreRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string, expiry time.Duration) error {
	args := m.Called(ctx, userID, tokenID, expiry)
	return args.Error(0)
}

func (m *MockTokenStore) ValidateRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string) (bool, error) {
	args := m.Called(ctx, userID, tokenID)
	return args.Bool(0), args.Error(1)
}

func (m *MockTokenStore) RevokeRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string) error {
	args := m.Called(ctx, userID, tokenID)
	return args.Error(0)
}

func (m *MockTokenStore) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func TestAuthHandler_Register(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-access-secret-32-chars-long!", "test-refresh-secret-32-chars-long", 15*time.Minute, 7*24*time.Hour)
	userRepo := new(MockUserRepo)
	tokenStore := new(MockTokenStore)
	authSvc := service.NewAuthService(userRepo, tokenStore, jwtManager)
	handler := NewAuthHandler(authSvc)

	userRepo.On("GetByEmail", mock.Anything, "alice@example.com").Return(nil, domain.ErrNotFound)
	userRepo.On("Create", mock.Anything, mock.AnythingOfType("*domain.User")).Return(nil)
	tokenStore.On("StoreRefreshToken", mock.Anything, mock.AnythingOfType("uuid.UUID"), mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration")).Return(nil)

	payload := map[string]string{
		"email":    "alice@example.com",
		"password": "Password123!",
		"role":     "ADMIN",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Register(w, req)

	resp := w.Result()
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var res map[string]any
	err := json.NewDecoder(resp.Body).Decode(&res)
	require.NoError(t, err)
	assert.NotNil(t, res["user"])
	assert.NotNil(t, res["tokens"])

	cookies := resp.Cookies()
	require.NotEmpty(t, cookies)
	assert.Equal(t, "pulsegrid_refresh", cookies[0].Name)
}
