package ingest

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const maxWebhookBody = 1 << 20

// Routes mounts /webhooks. These are the only unauthenticated endpoints; an HMAC over the raw
// body stands in for a session.
func Routes(db store.DB, q jobs.Queue, secret string, production bool, log *slog.Logger) chi.Router {
	r := chi.NewRouter()

	r.Post("/roomalert", func(w http.ResponseWriter, req *http.Request) {
		raw, err := verified(req, secret, production, log)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		event, err := ParseWebhook(raw)
		if err != nil {
			httpx.Fail(w, req, httpx.BadRequest("VALIDATION_FAILED", err.Error()))
			return
		}
		respond(w, req, db, q, "/webhooks/roomalert", "roomalert", event)
	})

	r.Post("/email", func(w http.ResponseWriter, req *http.Request) {
		raw, err := verified(req, secret, production, log)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		body := raw
		if trimmed := strings.TrimSpace(raw); strings.HasPrefix(trimmed, "{") {
			// The IMAP poller wraps the mail as {"raw": "..."}.
			var wrapper struct {
				Raw string `json:"raw"`
			}
			if err := json.Unmarshal([]byte(trimmed), &wrapper); err == nil && wrapper.Raw != "" {
				body = wrapper.Raw
			}
		}
		respond(w, req, db, q, "/webhooks/email", "email", ParseEmail(body))
	})

	return r
}

func respond(w http.ResponseWriter, req *http.Request, db store.DB, q jobs.Queue, path, channel string, event Event) {
	started := time.Now()
	result, err := Ingest(req.Context(), db, q, event)
	if err != nil {
		httpx.Fail(w, req, err)
		return
	}
	status := http.StatusAccepted
	summary := "alert accepted"
	if !result.Accepted {
		status, summary = http.StatusUnprocessableEntity, result.Reason
	}
	if _, err := db.Exec(req.Context(), `
		INSERT INTO request_log (id, direction, channel, method, path, status, ms, summary)
		VALUES ($1,'inbound',$2,'POST',$3,$4,$5,$6)`,
		httpx.NewID("log"), channel, path, status, time.Since(started).Milliseconds(), summary); err != nil {
		httpx.Fail(w, req, err)
		return
	}
	httpx.JSON(w, status, result)
}

// verified reads the raw body once and checks the signature Room Alert sent with it.
func verified(req *http.Request, secret string, production bool, log *slog.Logger) (string, error) {
	body, err := io.ReadAll(io.LimitReader(req.Body, maxWebhookBody))
	if err != nil {
		return "", httpx.BadRequest("VALIDATION_FAILED", "Could not read the request body")
	}
	signature := strings.TrimPrefix(req.Header.Get("X-Signature"), "sha256=")
	if signature == "" {
		if production {
			return "", httpx.Unauthorized("Missing X-Signature header")
		}
		log.Warn("webhook accepted without a signature (development only)", "path", req.URL.Path)
		return string(body), nil
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	given, err := hex.DecodeString(signature)
	if err != nil || !hmac.Equal(given, mac.Sum(nil)) {
		return "", httpx.Unauthorized("Signature does not match the payload")
	}
	return string(body), nil
}
