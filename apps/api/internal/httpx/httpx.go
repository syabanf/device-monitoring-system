// Package httpx holds the HTTP conventions every handler shares: problem+json errors,
// JSON decoding with a size limit, cursor pagination and the page envelope.
package httpx

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
)

const maxBody = 1 << 20 // 1 MiB is plenty for every payload this API accepts.

// Error is an expected failure. Anything else becomes a 500 with no internals leaked.
type Error struct {
	Code   string
	Status int
	Title  string
	Detail string
}

func (e *Error) Error() string { return e.Title + ": " + e.Detail }

func NewError(code string, status int, title, detail string) *Error {
	return &Error{Code: code, Status: status, Title: title, Detail: detail}
}

func NotFound(what, id string) *Error {
	return NewError("NOT_FOUND", http.StatusNotFound, what+" not found", fmt.Sprintf("No %s with id %s", what, id))
}
func Forbidden(detail string) *Error {
	return NewError("FORBIDDEN", http.StatusForbidden, "Forbidden", detail)
}
func Unauthorized(detail string) *Error {
	return NewError("UNAUTHORIZED", http.StatusUnauthorized, "Unauthorized", detail)
}
func Conflict(code, detail string) *Error {
	return NewError(code, http.StatusConflict, "Conflict", detail)
}
func BadRequest(code, detail string) *Error {
	return NewError(code, http.StatusBadRequest, "Bad request", detail)
}

// Problem is RFC 7807. Every non-2xx response uses this shape.
type Problem struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail,omitempty"`
	Code   string `json:"code"`
}

// Page is the envelope every list endpoint returns.
type Page[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"nextCursor"`
}

func JSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("write response", "err", err)
	}
}

// Fail turns any error into problem+json. Unexpected errors are logged, never echoed.
func Fail(w http.ResponseWriter, r *http.Request, err error) {
	var appErr *Error
	if !errors.As(err, &appErr) {
		slog.ErrorContext(r.Context(), "unhandled", "err", err, "path", r.URL.Path)
		appErr = NewError("INTERNAL", http.StatusInternalServerError, "Internal server error", "")
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(appErr.Status)
	_ = json.NewEncoder(w).Encode(Problem{
		Type:   "https://docs.monitoring.wit.id/errors/" + lower(appErr.Code),
		Title:  appErr.Title,
		Status: appErr.Status,
		Detail: appErr.Detail,
		Code:   appErr.Code,
	})
}

// Validator lets a request body check itself before the service sees it.
type Validator interface{ Validate() error }

// Decode reads JSON, rejects unknown fields and runs the body's own validation.
func Decode[T any](r *http.Request, dst *T) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return BadRequest("VALIDATION_FAILED", "Body is not valid JSON for this endpoint: "+err.Error())
	}
	if v, ok := any(dst).(Validator); ok {
		if err := v.Validate(); err != nil {
			return BadRequest("VALIDATION_FAILED", err.Error())
		}
	}
	return nil
}

// Limit reads ?limit= with a sane default and a hard ceiling.
func Limit(r *http.Request, def, max int) int {
	n, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

// Cursors stay opaque so the sort key can change without breaking clients.
func EncodeCursor(v string) string { return base64.RawURLEncoding.EncodeToString([]byte(v)) }

func DecodeCursor(v string) string {
	if v == "" {
		return ""
	}
	raw, err := base64.RawURLEncoding.DecodeString(v)
	if err != nil {
		return ""
	}
	return string(raw)
}

func lower(s string) string {
	out := []rune(s)
	for i, r := range out {
		if r >= 'A' && r <= 'Z' {
			out[i] = r + 32
		}
		if r == '_' {
			out[i] = '-'
		}
	}
	return string(out)
}
