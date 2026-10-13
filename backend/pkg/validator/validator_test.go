package validator

import (
	"testing"

	"github.com/pulsegrid/backend/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestValidateRegisterInput(t *testing.T) {
	tests := []struct {
		name    string
		input   domain.RegisterInput
		wantErr bool
	}{
		{
			name: "valid admin registration",
			input: domain.RegisterInput{
				Email:    "test@example.com",
				Password: "password123",
				Role:     "ADMIN",
			},
			wantErr: false,
		},
		{
			name: "invalid email",
			input: domain.RegisterInput{
				Email:    "invalid-email",
				Password: "password123",
			},
			wantErr: true,
		},
		{
			name: "password too short",
			input: domain.RegisterInput{
				Email:    "valid@example.com",
				Password: "short",
			},
			wantErr: true,
		},
		{
			name: "invalid role",
			input: domain.RegisterInput{
				Email:    "valid@example.com",
				Password: "password123",
				Role:     "SUPER_ADMIN",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := ValidateRegisterInput(tt.input)
			if tt.wantErr {
				assert.NotEmpty(t, errs)
			} else {
				assert.Empty(t, errs)
			}
		})
	}
}

func TestValidateMonitorInput(t *testing.T) {
	tests := []struct {
		name    string
		input   domain.MonitorCreateInput
		wantErr bool
	}{
		{
			name: "valid monitor input",
			input: domain.MonitorCreateInput{
				Name:            "Production API",
				URL:             "https://api.example.com/health",
				Method:          "GET",
				ExpectedStatus:  200,
				IntervalSeconds: 60,
				TimeoutMS:       5000,
			},
			wantErr: false,
		},
		{
			name: "missing name",
			input: domain.MonitorCreateInput{
				URL: "https://api.example.com",
			},
			wantErr: true,
		},
		{
			name: "invalid method",
			input: domain.MonitorCreateInput{
				Name:   "Test",
				URL:    "https://api.example.com",
				Method: "DELETE",
			},
			wantErr: true,
		},
		{
			name: "invalid status code",
			input: domain.MonitorCreateInput{
				Name:           "Test",
				URL:            "https://api.example.com",
				ExpectedStatus: 999,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := ValidateMonitorInput(tt.input)
			if tt.wantErr {
				assert.NotEmpty(t, errs)
			} else {
				assert.Empty(t, errs)
			}
		})
	}
}
