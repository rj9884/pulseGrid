package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
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

func TestAuthService_Register(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-access-secret-32-chars-long!", "test-refresh-secret-32-chars-long", 15*time.Minute, 7*24*time.Hour)

	t.Run("successfully registers user", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		ctx := context.Background()
		input := domain.RegisterInput{
			Email:    "new@example.com",
			Password: "securePassword123",
			Role:     domain.RoleAdmin,
		}

		userRepo.On("GetByEmail", ctx, "new@example.com").Return(nil, domain.ErrNotFound)
		userRepo.On("Create", ctx, mock.AnythingOfType("*domain.User")).Return(nil)
		tokenStore.On("StoreRefreshToken", ctx, mock.AnythingOfType("uuid.UUID"), mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration")).Return(nil)

		profile, tokens, err := svc.Register(ctx, input)
		require.NoError(t, err)
		assert.Equal(t, "new@example.com", profile.Email)
		assert.NotEmpty(t, tokens.AccessToken)
		assert.NotEmpty(t, tokens.RefreshToken)
		userRepo.AssertExpectations(t)
	})

	t.Run("fails when email already exists", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		ctx := context.Background()
		input := domain.RegisterInput{
			Email:    "existing@example.com",
			Password: "securePassword123",
		}

		userRepo.On("GetByEmail", ctx, "existing@example.com").Return(&domain.User{Email: "existing@example.com"}, nil)

		profile, tokens, err := svc.Register(ctx, input)
		assert.Error(t, err)
		assert.Nil(t, profile)
		assert.Nil(t, tokens)
	})
}

func TestAuthService_Login(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-access-secret-32-chars-long!", "test-refresh-secret-32-chars-long", 15*time.Minute, 7*24*time.Hour)
	ctx := context.Background()

	hash, _ := auth.HashPassword("correctPassword123")
	user := &domain.User{
		ID:           uuid.New(),
		Email:        "user@example.com",
		PasswordHash: hash,
		Role:         domain.RoleAdmin,
	}

	t.Run("valid credentials succeed", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		userRepo.On("GetByEmail", ctx, "user@example.com").Return(user, nil)
		tokenStore.On("StoreRefreshToken", ctx, user.ID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration")).Return(nil)

		profile, tokens, err := svc.Login(ctx, domain.LoginInput{
			Email:    "user@example.com",
			Password: "correctPassword123",
		})

		require.NoError(t, err)
		assert.Equal(t, user.ID, profile.ID)
		assert.NotEmpty(t, tokens.AccessToken)
	})

	t.Run("invalid password fails", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		userRepo.On("GetByEmail", ctx, "user@example.com").Return(user, nil)

		profile, tokens, err := svc.Login(ctx, domain.LoginInput{
			Email:    "user@example.com",
			Password: "wrongPassword",
		})

		assert.Error(t, err)
		assert.Nil(t, profile)
		assert.Nil(t, tokens)
	})
}
