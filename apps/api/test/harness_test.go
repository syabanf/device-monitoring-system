// Package test drives the whole HTTP surface against a real Postgres. Every repo query, cursor
// and scope clause runs here, which the unit tests in internal/ cannot reach.
//
// Set DATABASE_URL to run it, for example:
//
//	pnpm infra:up
//	DATABASE_URL=postgres://monitoring:monitoring@localhost:5442/monitoring?sslmode=disable go test ./test/...
//
// The suite owns the schema it runs against, so point it at a throwaway database.
package test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/config"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/server"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const (
	tenant       = "dst-test"
	otherTenant  = "dst-other"
	adminEmail   = "admin@test.id"
	adminPass    = "admin-password"
	employeeMail = "staff@test.id"
	techMail     = "tech@test.id"
	employeeTok  = "1111111111"
	techTok      = "2222222222"
	hookSecret   = "test-webhook-secret"
)

var (
	db      store.DB
	handler http.Handler
	signer  auth.Signer
)

func TestMain(m *testing.M) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		fmt.Println("DATABASE_URL is unset, skipping the integration suite")
		os.Exit(0)
	}

	ctx := context.Background()
	pool, err := store.Open(ctx, url)
	if err != nil {
		fmt.Println("cannot reach the database:", err)
		os.Exit(1)
	}
	db = pool
	if err := store.Migrate(ctx, db); err != nil {
		fmt.Println("migrate:", err)
		os.Exit(1)
	}

	cfg := config.Config{
		Env: "test", LogLevel: "error", JWTSecret: []byte(strings.Repeat("k", 40)), WebhookSecret: hookSecret,
		CORSOrigins: []string{"http://localhost:5173"}, AccessTokenTTL: time.Hour, DeviceTokenTTL: time.Hour,
	}
	signer = auth.NewSigner(cfg.JWTSecret)
	handler = server.New(server.Deps{
		Cfg: cfg, DB: db, Queue: jobs.NewInlineQueue(),
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	code := m.Run()
	db.Close()
	os.Exit(code)
}

// client wraps the router so a test reads like the call the frontend makes.
type client struct {
	t     *testing.T
	token string
}

func as(t *testing.T, token string) client { return client{t: t, token: token} }

type response struct {
	t      *testing.T
	Status int
	Body   []byte
}

func (c client) do(method, path string, body any) response {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			c.t.Fatalf("encode body: %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return response{t: c.t, Status: rec.Code, Body: rec.Body.Bytes()}
}

func (c client) get(path string) response          { return c.do(http.MethodGet, path, nil) }
func (c client) post(path string, b any) response  { return c.do(http.MethodPost, path, b) }
func (c client) put(path string, b any) response   { return c.do(http.MethodPut, path, b) }
func (c client) patch(path string, b any) response { return c.do(http.MethodPatch, path, b) }
func (c client) del(path string) response          { return c.do(http.MethodDelete, path, nil) }

// expect fails with the body attached, so a red test says why without a second run.
func (r response) expect(status int) response {
	r.t.Helper()
	if r.Status != status {
		r.t.Fatalf("want %d, got %d: %s", status, r.Status, truncate(r.Body))
	}
	return r
}

func (r response) code() string {
	r.t.Helper()
	var problem struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(r.Body, &problem); err != nil {
		r.t.Fatalf("response is not problem+json: %s", truncate(r.Body))
	}
	return problem.Code
}

func (r response) into(dst any) {
	r.t.Helper()
	if err := json.Unmarshal(r.Body, dst); err != nil {
		r.t.Fatalf("decode %T: %v (%s)", dst, err, truncate(r.Body))
	}
}

// field reads one value out of a response without a struct, for the one-line assertions.
func (r response) field(path string) any {
	r.t.Helper()
	var doc any
	r.into(&doc)
	cur := doc
	for _, key := range strings.Split(path, ".") {
		switch node := cur.(type) {
		case map[string]any:
			cur = node[key]
		case []any:
			idx := 0
			fmt.Sscanf(key, "%d", &idx)
			if idx >= len(node) {
				r.t.Fatalf("index %d is past the end of %s", idx, path)
			}
			cur = node[idx]
		default:
			r.t.Fatalf("cannot read %q out of %T", key, cur)
		}
	}
	return cur
}

func (r response) str(path string) string {
	r.t.Helper()
	v, ok := r.field(path).(string)
	if !ok {
		r.t.Fatalf("%s is not a string: %s", path, truncate(r.Body))
	}
	return v
}

func (r response) num(path string) float64 {
	r.t.Helper()
	v, ok := r.field(path).(float64)
	if !ok {
		r.t.Fatalf("%s is not a number: %s", path, truncate(r.Body))
	}
	return v
}

func (r response) items() []any {
	r.t.Helper()
	v, ok := r.field("items").([]any)
	if !ok {
		r.t.Fatalf("response has no items array: %s", truncate(r.Body))
	}
	return v
}

func truncate(b []byte) string {
	if len(b) > 400 {
		return string(b[:400]) + "…"
	}
	return string(b)
}

func token(t *testing.T, kind auth.Kind, subject, distributor string, outlets []string) string {
	t.Helper()
	claims := auth.Claims{Kind: kind, DistributorID: distributor, OutletIDs: outlets}
	claims.Subject = subject
	signed, err := signer.Sign(claims, time.Hour, time.Now())
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}
