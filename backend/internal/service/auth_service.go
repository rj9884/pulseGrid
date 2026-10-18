package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/repository"
	"github.com/pulsegrid/backend/pkg/auth"
	"github.com/pulsegrid/backend/pkg/validator"
)

type AuthService struct {
	userRepo   repository.UserRepository
	tokenStore repository.TokenStore
	jwtManager *auth.JWTManager
}

func NewAuthService(
	userRepo repository.UserRepository,
	tokenStore repository.TokenStore,
	jwtManager *auth.JWTManager,
) *AuthService {
	return &AuthService{
		userRepo:   userRepo,
		tokenStore: tokenStore,
		jwtManager: jwtManager,
	}
}

func (s *AuthService) Register(ctx context.Context, input domain.RegisterInput) (*domain.UserProfile, *domain.AuthTokens, error) {
	if valErrs := validator.ValidateRegisterInput(input); len(valErrs) > 0 {
		return nil, nil, domain.NewValidationError("invalid registration data", valErrs)
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(input.Email))
	existing, err := s.userRepo.GetByEmail(ctx, normalizedEmail)
	if err == nil && existing != nil {
		return nil, nil, domain.NewConflictError("email is already registered")
	}

	hash, err := auth.HashPassword(input.Password)
	if err != nil {
		return nil, nil, domain.NewInternalError(err)
	}

	role := input.Role
	if role == "" {
		role = domain.RoleAdmin
	}

	user := &domain.User{
		ID:           uuid.New(),
		Email:        normalizedEmail,
		PasswordHash: hash,
		Role:         role,
		CreatedAt:    time.Now(),
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, nil, err
	}

	tokens, err := s.generateTokens(ctx, user.ID, user.Role)
	if err != nil {
		return nil, nil, domain.NewInternalError(err)
	}

	profile := &domain.UserProfile{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}

	return profile, tokens, nil
}

func (s *AuthService) Login(ctx context.Context, input domain.LoginInput) (*domain.UserProfile, *domain.AuthTokens, error) {
	if valErrs := validator.ValidateLoginInput(input); len(valErrs) > 0 {
		return nil, nil, domain.NewValidationError("invalid login credentials", valErrs)
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(input.Email))
	user, err := s.userRepo.GetByEmail(ctx, normalizedEmail)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil, domain.NewUnauthorizedError("invalid email or password")
		}
		return nil, nil, domain.NewInternalError(err)
	}

	if !auth.CheckPassword(input.Password, user.PasswordHash) {
		return nil, nil, domain.NewUnauthorizedError("invalid email or password")
	}

	tokens, err := s.generateTokens(ctx, user.ID, user.Role)
	if err != nil {
		return nil, nil, domain.NewInternalError(err)
	}

	profile := &domain.UserProfile{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}

	return profile, tokens, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshTokenStr string) (*domain.AuthTokens, error) {
	if strings.TrimSpace(refreshTokenStr) == "" {
		return nil, domain.NewUnauthorizedError("missing refresh token")
	}

	claims, err := s.jwtManager.ValidateRefreshToken(refreshTokenStr)
	if err != nil {
		return nil, domain.NewUnauthorizedError("invalid or expired refresh token")
	}

	valid, err := s.tokenStore.ValidateRefreshToken(ctx, claims.UserID, claims.ID)
	if err != nil || !valid {
		return nil, domain.NewUnauthorizedError("refresh token revoked or expired")
	}

	_ = s.tokenStore.RevokeRefreshToken(ctx, claims.UserID, claims.ID)

	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, domain.NewUnauthorizedError("user no longer exists")
	}

	tokens, err := s.generateTokens(ctx, user.ID, user.Role)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	return tokens, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshTokenStr string) error {
	if strings.TrimSpace(refreshTokenStr) == "" {
		return nil
	}

	claims, err := s.jwtManager.ValidateRefreshToken(refreshTokenStr)
	if err != nil {
		return nil
	}

	return s.tokenStore.RevokeRefreshToken(ctx, claims.UserID, claims.ID)
}

func (s *AuthService) GetProfile(ctx context.Context, userID uuid.UUID) (*domain.UserProfile, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &domain.UserProfile{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}, nil
}

func (s *AuthService) generateTokens(ctx context.Context, userID uuid.UUID, role string) (*domain.AuthTokens, error) {
	accessToken, err := s.jwtManager.GenerateAccessToken(userID, role)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(userID, role)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	refreshClaims, err := s.jwtManager.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("validate refresh token claims: %w", err)
	}

	if err := s.tokenStore.StoreRefreshToken(ctx, userID, refreshClaims.ID, s.jwtManager.RefreshExpiry()); err != nil {
		return nil, fmt.Errorf("persist refresh token: %w", err)
	}

	return &domain.AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(s.jwtManager.AccessExpiry().Seconds()),
	}, nil
}
