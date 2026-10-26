package worker

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCalculateJitterBackoff(t *testing.T) {
	base := 2 * time.Second
	capDuration := 60 * time.Second

	for attempt := 0; attempt < 5; attempt++ {
		multiplier := 1 << attempt
		maxSleep := base * time.Duration(multiplier)
		if maxSleep > capDuration {
			maxSleep = capDuration
		}

		for sample := 0; sample < 10; sample++ {
			backoff := CalculateJitterBackoff(attempt, base, capDuration)
			assert.GreaterOrEqual(t, backoff, time.Duration(0))
			assert.LessOrEqual(t, backoff, maxSleep)
		}
	}
}
