package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var input domain.RegisterInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, domain.NewValidationError("invalid json request payload", nil))
		return
	}

	profile, tokens, err := h.authService.Register(r.Context(), input)
	if err != nil {
		RespondError(w, err)
		return
	}

	h.setRefreshCookie(w, tokens.RefreshToken, 7*24*time.Hour)

	RespondJSON(w, http.StatusCreated, map[string]any{
		"user":   profile,
		"tokens": tokens,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var input domain.LoginInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, domain.NewValidationError("invalid json request payload", nil))
		return
	}

	profile, tokens, err := h.authService.Login(r.Context(), input)
	if err != nil {
		RespondError(w, err)
		return
	}

	h.setRefreshCookie(w, tokens.RefreshToken, 7*24*time.Hour)

	RespondJSON(w, http.StatusOK, map[string]any{
		"user":   profile,
		"tokens": tokens,
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var refreshToken string

	if cookie, err := r.Cookie("pulsegrid_refresh"); err == nil && cookie.Value != "" {
		refreshToken = cookie.Value
	} else {
		var req struct {
			RefreshToken string `json:"refresh_token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		refreshToken = req.RefreshToken
	}

	if refreshToken == "" {
		RespondError(w, domain.NewUnauthorizedError("missing refresh token"))
		return
	}

	tokens, err := h.authService.Refresh(r.Context(), refreshToken)
	if err != nil {
		RespondError(w, err)
		return
	}

	h.setRefreshCookie(w, tokens.RefreshToken, 7*24*time.Hour)

	RespondJSON(w, http.StatusOK, tokens)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var refreshToken string
	if cookie, err := r.Cookie("pulsegrid_refresh"); err == nil {
		refreshToken = cookie.Value
	}

	_ = h.authService.Logout(r.Context(), refreshToken)
	h.setRefreshCookie(w, "", -1*time.Hour)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value("user_id")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		RespondError(w, domain.NewUnauthorizedError("unauthenticated"))
		return
	}

	profile, err := h.authService.GetProfile(r.Context(), userID)
	if err != nil {
		RespondError(w, err)
		return
	}

	RespondJSON(w, http.StatusOK, profile)
}

func (h *AuthHandler) setRefreshCookie(w http.ResponseWriter, token string, maxAge time.Duration) {
	cookie := &http.Cookie{
		Name:     "pulsegrid_refresh",
		Value:    token,
		Path:     "/api/v1/auth",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(maxAge.Seconds()),
	}
	http.SetCookie(w, cookie)
}
