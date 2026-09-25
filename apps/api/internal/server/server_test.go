package server_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/config"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/server"
)

// The router is built without a database on purpose: these cases never reach a repo, so they
// prove the auth, tenancy and error conventions on their own.
func newRouter(t *testing.T) (http.Handler, auth.Signer) {
	t.Helper()
	cfg := config.Config{
		Env: "test", Port: 0, LogLevel: "error",
		JWTSecret:   []byte(strings.Repeat("x", 40)),
		CORSOrigins: []string{"http://localhost:5173"}, AccessTokenTTL: 15 * time.Minute, DeviceTokenTTL: time.Hour,
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return server.New(server.Deps{Cfg: cfg, DB: nil, Queue: jobs.NewInlineQueue(), Log: log}), auth.NewSigner(cfg.JWTSecret)
}

func token(t *testing.T, s auth.Signer, kind auth.Kind, tenant string) string {
	t.Helper()
	claims := auth.Claims{Kind: kind, DistributorID: tenant}
	claims.Subject = "adm-001"
	signed, err := s.Sign(claims, time.Hour, time.Now())
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

func do(t *testing.T, h http.Handler, method, path, bearer, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func problemCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var p struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("response is not problem+json: %s", rec.Body.String())
	}
	return p.Code
}

func TestHealthReportsQueueMode(t *testing.T) {
	h, _ := newRouter(t)
	rec := do(t, h, http.MethodGet, "/health", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["queue"] != "inline" || body["db"] != "down" {
		t.Fatalf("unexpected health body: %v", body)
	}
}

func TestTenantReadRequiresAToken(t *testing.T) {
	h, _ := newRouter(t)
	for _, path := range []string{
		"/distributors/dst-sby/outlets",
		"/distributors/dst-sby/devices",
		"/distributors/dst-sby/employees",
		"/distributors/dst-sby/technicians",
		"/distributors/dst-sby/contact-persons",
		"/distributors/dst-sby/alerts",
		"/distributors/dst-sby/tickets",
		"/device-types",
	} {
		rec := do(t, h, http.MethodGet, path, "", "")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: want 401, got %d", path, rec.Code)
		}
		if code := problemCode(t, rec); code != "UNAUTHORIZED" {
			t.Errorf("%s: want UNAUTHORIZED, got %s", path, code)
		}
	}
}

func TestTokenFromAnotherTenantIsForbidden(t *testing.T) {
	h, signer := newRouter(t)
	rec := do(t, h, http.MethodGet, "/distributors/dst-jkt/outlets", token(t, signer, auth.KindAdmin, "dst-sby"), "")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403, got %d", rec.Code)
	}
	if code := problemCode(t, rec); code != "FORBIDDEN" {
		t.Fatalf("want FORBIDDEN, got %s", code)
	}
}

func TestEmployeeCannotWriteMasterData(t *testing.T) {
	h, signer := newRouter(t)
	body := `{"code":"IDM-SBY-0099","name":"Indomaret Test","address":"Jl. Test","city":"Surabaya","province":"Jawa Timur","lat":-7.1,"lng":112.7,"mapsUrl":"","openTime":"07:00","closeTime":"22:00","timezone":"Asia/Jakarta","phone":""}`
	rec := do(t, h, http.MethodPost, "/distributors/dst-sby/outlets", token(t, signer, auth.KindEmployee, "dst-sby"), body)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestBodyValidationAnswersProblemJSON(t *testing.T) {
	h, _ := newRouter(t)
	rec := do(t, h, http.MethodPost, "/auth/admin/login", "", `{"email":"not-an-email","password":"123"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Fatalf("want problem+json, got %s", ct)
	}
	if code := problemCode(t, rec); code != "VALIDATION_FAILED" {
		t.Fatalf("want VALIDATION_FAILED, got %s", code)
	}
}

func TestUnknownFieldsAreRejected(t *testing.T) {
	h, _ := newRouter(t)
	rec := do(t, h, http.MethodPost, "/auth/token/login", "", `{"email":"a@b.id","token":"1234567890","admin":true}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for an unknown field, got %d", rec.Code)
	}
}

func TestUnknownRouteIsProblemJSON(t *testing.T) {
	h, _ := newRouter(t)
	rec := do(t, h, http.MethodGet, "/nope", "", "")
	if rec.Code != http.StatusNotFound || problemCode(t, rec) != "NOT_FOUND" {
		t.Fatalf("want 404 NOT_FOUND, got %d %s", rec.Code, rec.Body.String())
	}
}
