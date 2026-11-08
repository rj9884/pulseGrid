package sse

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/pulsegrid/backend/internal/domain"
	"github.com/pulsegrid/backend/internal/repository"
	"github.com/pulsegrid/backend/internal/transport/http/handlers"
	"github.com/pulsegrid/backend/pkg/auth"
)

type Hub struct {
	publisher  repository.EventPublisher
	jwtManager *auth.JWTManager
	logger     *slog.Logger
}

func NewHub(publisher repository.EventPublisher, jwtManager *auth.JWTManager, logger *slog.Logger) *Hub {
	return &Hub{
		publisher:  publisher,
		jwtManager: jwtManager,
		logger:     logger,
	}
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		if u, okWrap := w.(interface{ Unwrap() http.ResponseWriter }); okWrap {
			flusher, ok = u.Unwrap().(http.Flusher)
		}
	}
	if !ok {
		handlers.RespondError(w, domain.NewInternalError(fmt.Errorf("streaming unsupported")))
		return
	}

	var token string
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		}
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}

	if token == "" {
		handlers.RespondError(w, domain.NewUnauthorizedError("missing auth token for event stream"))
		return
	}

	claims, err := h.jwtManager.ValidateAccessToken(token)
	if err != nil {
		handlers.RespondError(w, domain.NewUnauthorizedError("invalid auth token for event stream"))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	eventChan, cleanup, err := h.publisher.SubscribeCheckEvents(r.Context(), claims.UserID)
	if err != nil {
		h.logger.Error("failed to subscribe to check events", "user_id", claims.UserID, "error", err)
		handlers.RespondError(w, domain.NewInternalError(err))
		return
	}
	defer cleanup()

	// Initial connected event
	fmt.Fprintf(w, "event: connected\ndata: %s\n\n", `{"status":"connected"}`)
	flusher.Flush()

	heartbeatTicker := time.NewTicker(15 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeatTicker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case event, ok := <-eventChan:
			if !ok {
				return
			}
			data, err := json.Marshal(event)
			if err == nil {
				fmt.Fprintf(w, "event: check_completed\ndata: %s\n\n", string(data))
				flusher.Flush()
			}
		}
	}
}

func (h *Hub) BroadcastCheckResult(ctx context.Context, event domain.CheckEventPayload) error {
	return h.publisher.PublishCheckEvent(ctx, event)
}

func GetUserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	return handlers.GetUserID(ctx)
}
