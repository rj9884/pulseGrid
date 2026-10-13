package validator

import (
	"net/mail"
	"strings"

	"github.com/pulsegrid/backend/internal/domain"
)

var allowedMethods = map[string]bool{
	"GET":  true,
	"POST": true,
	"HEAD": true,
}

func ValidateRegisterInput(input domain.RegisterInput) map[string]string {
	errs := make(map[string]string)

	if strings.TrimSpace(input.Email) == "" {
		errs["email"] = "email is required"
	} else if _, err := mail.ParseAddress(input.Email); err != nil {
		errs["email"] = "invalid email address format"
	}

	if len(input.Password) < 8 {
		errs["password"] = "password must be at least 8 characters"
	}

	if input.Role != "" && input.Role != domain.RoleAdmin && input.Role != domain.RoleViewer {
		errs["role"] = "role must be ADMIN or VIEWER"
	}

	if len(errs) == 0 {
		return nil
	}
	return errs
}

func ValidateLoginInput(input domain.LoginInput) map[string]string {
	errs := make(map[string]string)

	if strings.TrimSpace(input.Email) == "" {
		errs["email"] = "email is required"
	}
	if input.Password == "" {
		errs["password"] = "password is required"
	}

	if len(errs) == 0 {
		return nil
	}
	return errs
}

func ValidateMonitorInput(input domain.MonitorCreateInput) map[string]string {
	errs := make(map[string]string)

	name := strings.TrimSpace(input.Name)
	if name == "" {
		errs["name"] = "name is required"
	} else if len(name) > 100 {
		errs["name"] = "name must not exceed 100 characters"
	}

	if strings.TrimSpace(input.URL) == "" {
		errs["url"] = "url is required"
	}

	method := strings.ToUpper(strings.TrimSpace(input.Method))
	if method == "" {
		method = "GET"
	}
	if !allowedMethods[method] {
		errs["method"] = "method must be GET, POST, or HEAD"
	}

	if input.ExpectedStatus != 0 && (input.ExpectedStatus < 100 || input.ExpectedStatus > 599) {
		errs["expected_status"] = "expected_status must be a valid HTTP status code between 100 and 599"
	}

	if input.IntervalSeconds != 0 && (input.IntervalSeconds < 5 || input.IntervalSeconds > 86400) {
		errs["interval_seconds"] = "interval_seconds must be between 5 and 86400 seconds"
	}

	if input.TimeoutMS != 0 && (input.TimeoutMS < 500 || input.TimeoutMS > 60000) {
		errs["timeout_ms"] = "timeout_ms must be between 500 and 60000 milliseconds"
	}

	if len(errs) == 0 {
		return nil
	}
	return errs
}

func ValidateAlertChannelInput(input domain.AlertChannelCreateInput) map[string]string {
	errs := make(map[string]string)

	name := strings.TrimSpace(input.Name)
	if name == "" {
		errs["name"] = "name is required"
	} else if len(name) > 100 {
		errs["name"] = "name must not exceed 100 characters"
	}

	webhookURL := strings.TrimSpace(input.WebhookURL)
	if webhookURL == "" {
		errs["webhook_url"] = "webhook_url is required"
	} else if !strings.HasPrefix(webhookURL, "http://") && !strings.HasPrefix(webhookURL, "https://") {
		errs["webhook_url"] = "webhook_url must start with http:// or https://"
	}

	if len(errs) == 0 {
		return nil
	}
	return errs
}
