package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/pulsegrid/backend/internal/domain"
)

const (
	tokenPrefix       = "pulsegrid:token:"
	alertQueueKey     = "pulsegrid:queue:alerts"
	eventChannelPrefix = "pulsegrid:events:user:"
)

type Client struct {
	rdb *redis.Client
}

func NewClient(ctx context.Context, addr string) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     20,
	})

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return nil, fmt.Errorf("connect to redis at %s: %w", addr, err)
	}

	return &Client{rdb: rdb}, nil
}

func (c *Client) Close() error {
	return c.rdb.Close()
}

func (c *Client) StoreRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string, expiry time.Duration) error {
	key := fmt.Sprintf("%s%s:%s", tokenPrefix, userID.String(), tokenID)
	return c.rdb.Set(ctx, key, "active", expiry).Err()
}

func (c *Client) ValidateRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string) (bool, error) {
	key := fmt.Sprintf("%s%s:%s", tokenPrefix, userID.String(), tokenID)
	val, err := c.rdb.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return val == "active", nil
}

func (c *Client) RevokeRefreshToken(ctx context.Context, userID uuid.UUID, tokenID string) error {
	key := fmt.Sprintf("%s%s:%s", tokenPrefix, userID.String(), tokenID)
	return c.rdb.Del(ctx, key).Err()
}

func (c *Client) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	pattern := fmt.Sprintf("%s%s:*", tokenPrefix, userID.String())
	iter := c.rdb.Scan(ctx, 0, pattern, 0).Iterator()
	for iter.Next(ctx) {
		if err := c.rdb.Del(ctx, iter.Val()).Err(); err != nil {
			return err
		}
	}
	return iter.Err()
}

func (c *Client) PublishCheckEvent(ctx context.Context, event domain.CheckEventPayload) error {
	channel := fmt.Sprintf("%s%s", eventChannelPrefix, event.UserID.String())
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal check event: %w", err)
	}
	return c.rdb.Publish(ctx, channel, payload).Err()
}

func (c *Client) SubscribeCheckEvents(ctx context.Context, userID uuid.UUID) (<-chan domain.CheckEventPayload, func(), error) {
	channel := fmt.Sprintf("%s%s", eventChannelPrefix, userID.String())
	pubsub := c.rdb.Subscribe(ctx, channel)

	out := make(chan domain.CheckEventPayload, 100)

	go func() {
		defer close(out)
		ch := pubsub.Channel()
		for msg := range ch {
			var event domain.CheckEventPayload
			if err := json.Unmarshal([]byte(msg.Payload), &event); err == nil {
				select {
				case out <- event:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	cleanup := func() {
		_ = pubsub.Close()
	}

	return out, cleanup, nil
}

func (c *Client) EnqueueAlert(ctx context.Context, alert domain.AlertNotificationJob) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("marshal alert job: %w", err)
	}
	return c.rdb.LPush(ctx, alertQueueKey, data).Err()
}

func (c *Client) ConsumeAlert(ctx context.Context) (*domain.AlertNotificationJob, error) {
	res, err := c.rdb.BRPop(ctx, 2*time.Second, alertQueueKey).Result()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if len(res) < 2 {
		return nil, nil
	}

	var job domain.AlertNotificationJob
	if err := json.Unmarshal([]byte(res[1]), &job); err != nil {
		return nil, fmt.Errorf("unmarshal alert job: %w", err)
	}
	return &job, nil
}
