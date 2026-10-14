package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	RoleAdmin  = "ADMIN"
	RoleViewer = "VIEWER"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

type RegisterInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

type UserProfile struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}
