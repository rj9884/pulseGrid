package domain

import (
	"errors"
	"fmt"
	"net/http"
)

var (
	ErrNotFound          = errors.New("resource not found")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrForbidden         = errors.New("forbidden")
	ErrConflict          = errors.New("resource conflict")
	ErrInvalidInput      = errors.New("invalid input")
	ErrInternal          = errors.New("internal server error")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrTokenExpired      = errors.New("token expired")
	ErrTokenInvalid      = errors.New("invalid token")
	ErrSSRFDetected      = errors.New("target host is restricted or resolves to a private network")
)

type ProblemDetails struct {
	Type     string            `json:"type"`
	Title    string            `json:"title"`
	Status   int               `json:"status"`
	Detail   string            `json:"detail"`
	Instance string            `json:"instance,omitempty"`
	Errors   map[string]string `json:"errors,omitempty"`
}

type AppError struct {
	Err        error
	Message    string
	StatusCode int
	Validation map[string]string
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func NewNotFoundError(resource string) *AppError {
	return &AppError{
		Err:        ErrNotFound,
		Message:    fmt.Sprintf("%s not found", resource),
		StatusCode: http.StatusNotFound,
	}
}

func NewUnauthorizedError(message string) *AppError {
	return &AppError{
		Err:        ErrUnauthorized,
		Message:    message,
		StatusCode: http.StatusUnauthorized,
	}
}

func NewForbiddenError(message string) *AppError {
	return &AppError{
		Err:        ErrForbidden,
		Message:    message,
		StatusCode: http.StatusForbidden,
	}
}

func NewConflictError(message string) *AppError {
	return &AppError{
		Err:        ErrConflict,
		Message:    message,
		StatusCode: http.StatusConflict,
	}
}

func NewValidationError(message string, validation map[string]string) *AppError {
	return &AppError{
		Err:        ErrInvalidInput,
		Message:    message,
		StatusCode: http.StatusUnprocessableEntity,
		Validation: validation,
	}
}

func NewInternalError(err error) *AppError {
	return &AppError{
		Err:        err,
		Message:    "internal server error",
		StatusCode: http.StatusInternalServerError,
	}
}
