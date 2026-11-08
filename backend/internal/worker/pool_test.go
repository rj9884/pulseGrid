package worker

import (
	"testing"

	"github.com/pulsegrid/backend/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestEvaluateState(t *testing.T) {
	threshold := 2

	tests := []struct {
		name                 string
		currentStatus        domain.MonitorStatus
		currentFailures      int
		isUp                 bool
		expectedStatus       domain.MonitorStatus
		expectedFailures     int
		expectedStatusChange bool
	}{
		{
			name:                 "pending monitor succeeds -> becomes UP",
			currentStatus:        domain.StatusPending,
			currentFailures:      0,
			isUp:                 true,
			expectedStatus:       domain.StatusUp,
			expectedFailures:     0,
			expectedStatusChange: true,
		},
		{
			name:                 "pending monitor fails -> becomes DOWN immediately",
			currentStatus:        domain.StatusPending,
			currentFailures:      0,
			isUp:                 false,
			expectedStatus:       domain.StatusDown,
			expectedFailures:     1,
			expectedStatusChange: true,
		},
		{
			name:                 "UP monitor succeeds -> remains UP",
			currentStatus:        domain.StatusUp,
			currentFailures:      0,
			isUp:                 true,
			expectedStatus:       domain.StatusUp,
			expectedFailures:     0,
			expectedStatusChange: false,
		},
		{
			name:                 "UP monitor fails once -> remains UP (anti-flapping)",
			currentStatus:        domain.StatusUp,
			currentFailures:      0,
			isUp:                 false,
			expectedStatus:       domain.StatusUp,
			expectedFailures:     1,
			expectedStatusChange: false,
		},
		{
			name:                 "UP monitor fails twice (meets threshold) -> transitions to DOWN",
			currentStatus:        domain.StatusUp,
			currentFailures:      1,
			isUp:                 false,
			expectedStatus:       domain.StatusDown,
			expectedFailures:     2,
			expectedStatusChange: true,
		},
		{
			name:                 "DOWN monitor fails again -> stays DOWN with incremented failures",
			currentStatus:        domain.StatusDown,
			currentFailures:      2,
			isUp:                 false,
			expectedStatus:       domain.StatusDown,
			expectedFailures:     3,
			expectedStatusChange: false,
		},
		{
			name:                 "DOWN monitor succeeds once -> transitions to UP",
			currentStatus:        domain.StatusDown,
			currentFailures:      5,
			isUp:                 true,
			expectedStatus:       domain.StatusUp,
			expectedFailures:     0,
			expectedStatusChange: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, failures, changed := EvaluateState(
				tt.currentStatus,
				tt.currentFailures,
				tt.isUp,
				threshold,
			)

			assert.Equal(t, tt.expectedStatus, status)
			assert.Equal(t, tt.expectedFailures, failures)
			assert.Equal(t, tt.expectedStatusChange, changed)
		})
	}
}
