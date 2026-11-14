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

	t.Run("fails on validation error", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		ctx := context.Background()
		input := domain.RegisterInput{
			Email:    "invalid-email",
			Password: "short",
		}

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

	t.Run("fails when user not found", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		userRepo.On("GetByEmail", ctx, "nonexistent@example.com").Return(nil, domain.ErrNotFound)

		profile, tokens, err := svc.Login(ctx, domain.LoginInput{
			Email:    "nonexistent@example.com",
			Password: "anypassword",
		})

		assert.Error(t, err)
		assert.Nil(t, profile)
		assert.Nil(t, tokens)
	})

	t.Run("fails on validation error", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		profile, tokens, err := svc.Login(ctx, domain.LoginInput{
			Email:    "",
			Password: "",
		})

		assert.Error(t, err)
		assert.Nil(t, profile)
		assert.Nil(t, tokens)
	})
}

func TestAuthService_Refresh(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-access-secret-32-chars-long!", "test-refresh-secret-32-chars-long", 15*time.Minute, 7*24*time.Hour)
	ctx := context.Background()

	userID := uuid.New()
	refreshToken, _ := jwtManager.GenerateRefreshToken(userID, domain.RoleAdmin)
	claims, _ := jwtManager.ValidateRefreshToken(refreshToken)

	t.Run("successfully refreshes tokens", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		tokenStore.On("ValidateRefreshToken", ctx, userID, claims.ID).Return(true, nil)
		tokenStore.On("RevokeRefreshToken", ctx, userID, claims.ID).Return(nil)
		userRepo.On("GetByID", ctx, userID).Return(&domain.User{
			ID:    userID,
			Email: "user@example.com",
			Role:  domain.RoleAdmin,
		}, nil)
		tokenStore.On("StoreRefreshToken", ctx, userID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration")).Return(nil)

		tokens, err := svc.Refresh(ctx, refreshToken)
		require.NoError(t, err)
		assert.NotEmpty(t, tokens.AccessToken)
		assert.NotEmpty(t, tokens.RefreshToken)
	})

	t.Run("fails when token is revoked", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		tokenStore.On("ValidateRefreshToken", ctx, userID, claims.ID).Return(false, nil)

		tokens, err := svc.Refresh(ctx, refreshToken)
		assert.Error(t, err)
		assert.Nil(t, tokens)
	})

	t.Run("fails when user no longer exists", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		tokenStore.On("ValidateRefreshToken", ctx, userID, claims.ID).Return(true, nil)
		tokenStore.On("RevokeRefreshToken", ctx, userID, claims.ID).Return(nil)
		userRepo.On("GetByID", ctx, userID).Return(nil, domain.ErrNotFound)

		tokens, err := svc.Refresh(ctx, refreshToken)
		assert.Error(t, err)
		assert.Nil(t, tokens)
	})

	t.Run("fails on empty token", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		tokens, err := svc.Refresh(ctx, "")
		assert.Error(t, err)
		assert.Nil(t, tokens)
	})
}

func TestAuthService_Logout(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-access-secret-32-chars-long!", "test-refresh-secret-32-chars-long", 15*time.Minute, 7*24*time.Hour)
	ctx := context.Background()

	userID := uuid.New()
	refreshToken, _ := jwtManager.GenerateRefreshToken(userID, domain.RoleAdmin)
	claims, _ := jwtManager.ValidateRefreshToken(refreshToken)

	t.Run("revokes token on logout", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		tokenStore.On("RevokeRefreshToken", ctx, userID, claims.ID).Return(nil)

		err := svc.Logout(ctx, refreshToken)
		assert.NoError(t, err)
	})

	t.Run("handles empty token gracefully", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		err := svc.Logout(ctx, "")
		assert.NoError(t, err)
	})
}

func TestAuthService_GetProfile(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-access-secret-32-chars-long!", "test-refresh-secret-32-chars-long", 15*time.Minute, 7*24*time.Hour)
	ctx := context.Background()

	userID := uuid.New()

	t.Run("returns user profile", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		userRepo.On("GetByID", ctx, userID).Return(&domain.User{
			ID:        userID,
			Email:     "user@example.com",
			Role:      domain.RoleViewer,
			CreatedAt: time.Now(),
		}, nil)

		profile, err := svc.GetProfile(ctx, userID)
		require.NoError(t, err)
		assert.Equal(t, userID, profile.ID)
		assert.Equal(t, "user@example.com", profile.Email)
		assert.Equal(t, domain.RoleViewer, profile.Role)
	})

	t.Run("returns error when user not found", func(t *testing.T) {
		userRepo := new(MockUserRepo)
		tokenStore := new(MockTokenStore)
		svc := NewAuthService(userRepo, tokenStore, jwtManager)

		userRepo.On("GetByID", ctx, userID).Return(nil, domain.ErrNotFound)

		profile, err := svc.GetProfile(ctx, userID)
		assert.Error(t, err)
		assert.Nil(t, profile)
	})
}
