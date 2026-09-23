// Package integration backs the Integration page: the channel settings an admin edits, the
// request log the ingestion path writes, the events that matched no device, and the Test button.
package integration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/akcp"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// Config mirrors the shape the admin app already uses, minus the adapter mode, which belongs
// to the browser rather than the server.
type Config struct {
	APIBaseURL  string        `json:"apiBaseUrl"`
	WebhookPath string        `json:"webhookPath"`
	RoomAlert   RoomAlertConf `json:"roomAlert"`
	IMAP        IMAPConf      `json:"imap"`
	Telegram    TelegramConf  `json:"telegram"`
	Push        PushConf      `json:"push"`
}

type RoomAlertConf struct {
	AccountEmail    string `json:"accountEmail"`
	PushIntervalSec int    `json:"pushIntervalSec"`
	Enabled         bool   `json:"enabled"`
}

type IMAPConf struct {
	Host    string `json:"host"`
	Port    int    `json:"port"`
	User    string `json:"user"`
	Folder  string `json:"folder"`
	PollSec int    `json:"pollSec"`
	Enabled bool   `json:"enabled"`
}

type TelegramConf struct {
	BotToken string `json:"botToken"`
	ChatID   string `json:"chatId"`
	Enabled  bool   `json:"enabled"`
}

type PushConf struct {
	Provider string `json:"provider"`
	Enabled  bool   `json:"enabled"`
}

var defaults = Config{
	APIBaseURL:  "http://localhost:3000",
	WebhookPath: "/webhooks/roomalert",
	RoomAlert:   RoomAlertConf{AccountEmail: "", PushIntervalSec: 300, Enabled: true},
	IMAP:        IMAPConf{Host: "imap.gmail.com", Port: 993, Folder: "INBOX/RoomAlert", PollSec: 60},
	Push:        PushConf{Provider: "fcm", Enabled: true},
}

// Secrets never travel back to the browser; the page shows whether one is set. MQTT is read
// only: the broker lives in the deployment's environment, not in a form, so the page reports
// the connection rather than offering to change it.
type ConfigView struct {
	Config
	TelegramTokenSet bool        `json:"telegramTokenSet"`
	MQTT             akcp.Status `json:"mqtt"`
	UpdatedAt        time.Time   `json:"updatedAt"`
}

type LogEntry struct {
	ID        string    `json:"id"`
	At        time.Time `json:"at"`
	Direction string    `json:"direction"`
	Channel   string    `json:"channel"`
	Method    string    `json:"method"`
	Path      string    `json:"path"`
	Status    int       `json:"status"`
	MS        int       `json:"ms"`
	Summary   string    `json:"summary"`
}

type UnmatchedEvent struct {
	ID     string    `json:"id"`
	At     time.Time `json:"at"`
	Source string    `json:"source"`
	Reason string    `json:"reason"`
	Raw    string    `json:"raw"`
}

type TestResult struct {
	OK      bool   `json:"ok"`
	MS      int    `json:"ms"`
	Message string `json:"message"`
}

type Service struct {
	db     store.DB
	tenant string
	// mqtt reports the AKCP subscriber running next to this handler. It is nil in a build
	// without one, for example the test server.
	mqtt func() akcp.Status
}

func NewService(db store.DB, c auth.Ctx, mqtt func() akcp.Status) Service {
	return Service{db: db, tenant: c.Tenant, mqtt: mqtt}
}

// subscriber answers with a switched-off status when no subscriber runs in this process.
func (s Service) subscriber() akcp.Status {
	if s.mqtt == nil {
		return akcp.Status{TopicFilter: akcp.TopicFilter}
	}
	return s.mqtt()
}

func (s Service) Get(ctx context.Context) (ConfigView, error) {
	var raw []byte
	var updatedAt time.Time
	err := s.db.QueryRow(ctx, `SELECT settings, updated_at FROM integration_config WHERE distributor_id = $1`, s.tenant).
		Scan(&raw, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ConfigView{Config: defaults, MQTT: s.subscriber()}, nil
	}
	if err != nil {
		return ConfigView{}, err
	}
	cfg := defaults
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return ConfigView{}, err
	}
	view := ConfigView{Config: cfg, TelegramTokenSet: cfg.Telegram.BotToken != "", MQTT: s.subscriber(), UpdatedAt: updatedAt}
	view.Telegram.BotToken = ""
	return view, nil
}

// Save keeps the stored Telegram token when the browser sends an empty one back, so a round
// trip through the form never wipes a secret the page was not allowed to read.
func (s Service) Save(ctx context.Context, in Config) (ConfigView, error) {
	if in.Telegram.BotToken == "" {
		current, err := s.stored(ctx)
		if err != nil {
			return ConfigView{}, err
		}
		in.Telegram.BotToken = current.Telegram.BotToken
	}
	body, err := json.Marshal(in)
	if err != nil {
		return ConfigView{}, err
	}
	if _, err := s.db.Exec(ctx, `
		INSERT INTO integration_config (distributor_id, settings, updated_at) VALUES ($1, $2, now())
		ON CONFLICT (distributor_id) DO UPDATE SET settings = excluded.settings, updated_at = now()`,
		s.tenant, body); err != nil {
		return ConfigView{}, err
	}
	return s.Get(ctx)
}

func (s Service) stored(ctx context.Context) (Config, error) {
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT settings FROM integration_config WHERE distributor_id = $1`, s.tenant).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return defaults, nil
	}
	if err != nil {
		return Config{}, err
	}
	cfg := defaults
	return cfg, json.Unmarshal(raw, &cfg)
}

func (s Service) Log(ctx context.Context, limit int, channel string) ([]LogEntry, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, at, direction, channel, method, path, status, ms, summary FROM request_log
		WHERE (distributor_id IS NULL OR distributor_id = $1) AND ($2 = '' OR channel = $2)
		ORDER BY at DESC LIMIT $3`, s.tenant, channel, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []LogEntry{}
	for rows.Next() {
		var e LogEntry
		if err := rows.Scan(&e.ID, &e.At, &e.Direction, &e.Channel, &e.Method, &e.Path, &e.Status, &e.MS, &e.Summary); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s Service) Unmatched(ctx context.Context, limit int) ([]UnmatchedEvent, error) {
	rows, err := s.db.Query(ctx, `SELECT id, at, source, reason, raw FROM unmatched_event ORDER BY at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []UnmatchedEvent{}
	for rows.Next() {
		var e UnmatchedEvent
		if err := rows.Scan(&e.ID, &e.At, &e.Source, &e.Reason, &e.Raw); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Test reports what the Integration page's Test button can honestly claim today. Telegram and
// push have no client yet, so they say so rather than pretending to succeed.
func (s Service) Test(ctx context.Context, channel string) (TestResult, error) {
	started := time.Now()
	cfg, err := s.stored(ctx)
	if err != nil {
		return TestResult{}, err
	}
	result := TestResult{}
	switch channel {
	case "roomalert":
		var recent int
		if err := s.db.QueryRow(ctx, `SELECT count(*) FROM request_log WHERE channel = 'roomalert' AND at > now() - interval '24 hours'`).
			Scan(&recent); err != nil {
			return TestResult{}, err
		}
		result = TestResult{OK: true, Message: "Webhook endpoint is mounted, " + strconv.Itoa(recent) + " call(s) in the last 24 hours"}
	case "email":
		if !cfg.IMAP.Enabled {
			result = TestResult{Message: "IMAP is disabled in the settings"}
		} else {
			result = TestResult{Message: "The IMAP poller is not implemented yet, post to /webhooks/email meanwhile"}
		}
	case "akcp":
		st := s.subscriber()
		switch {
		case !st.Enabled:
			result = TestResult{Message: "No broker configured, set MQTT_BROKER_URL to switch the subscriber on"}
		case st.Connected:
			result = TestResult{OK: true, Message: fmt.Sprintf("Subscribed to %s on %s, %d message(s) received", st.TopicFilter, st.BrokerURL, st.Received)}
		default:
			why := st.LastError
			if why == "" {
				why = "connecting"
			}
			result = TestResult{Message: "Not connected to " + st.BrokerURL + ": " + why}
		}
	case "telegram":
		result = TestResult{Message: "No Telegram client yet, the outbox logs the broadcast instead"}
	case "push":
		result = TestResult{Message: "No push client yet, the outbox logs the notification instead"}
	default:
		return TestResult{}, httpx.BadRequest("UNKNOWN_CHANNEL", "channel must be roomalert, akcp, email, telegram or push")
	}
	result.MS = int(time.Since(started).Milliseconds())

	if _, err := s.db.Exec(ctx, `
		INSERT INTO request_log (id, distributor_id, direction, channel, method, path, status, ms, summary)
		VALUES ($1,$2,'outbound',$3,'POST',$4,$5,$6,$7)`,
		httpx.NewID("log"), s.tenant, channel, "/integrations/"+channel+"/test", statusOf(result.OK), result.MS, result.Message); err != nil {
		return TestResult{}, err
	}
	return result, nil
}

func statusOf(ok bool) int {
	if ok {
		return http.StatusOK
	}
	return http.StatusNotImplemented
}

// Routes mounts under /distributors/{distributorId}/integration.
func Routes(db store.DB, mqtt func() akcp.Status) chi.Router {
	r := chi.NewRouter()

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		cfg, err := NewService(db, c, mqtt).Get(req.Context())
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, cfg)
	})

	r.Put("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in Config
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		cfg, err := NewService(db, c, mqtt).Save(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, cfg)
	})

	r.Get("/request-log", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		items, err := NewService(db, c, mqtt).Log(req.Context(), httpx.Limit(req, 100, 500), req.URL.Query().Get("channel"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[LogEntry]{Items: items})
	})

	r.Get("/unmatched", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		items, err := NewService(db, c, mqtt).Unmatched(req.Context(), httpx.Limit(req, 50, 200))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[UnmatchedEvent]{Items: items})
	})

	r.Post("/test/{channel}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		result, err := NewService(db, c, mqtt).Test(req.Context(), chi.URLParam(req, "channel"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, result)
	})

	return r
}
