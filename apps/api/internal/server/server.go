// Package server wires every route onto one router. Building it has no side effects, so tests
// can exercise the whole surface without opening a port.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/alerts"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/config"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/contacts"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/devices"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/devicetypes"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/distributors"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/employees"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/ingest"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/integration"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/outlets"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/readings"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/stats"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/technicians"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/tickets"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/uploads"
)

type Deps struct {
	Cfg    config.Config
	DB     store.DB
	Queue  jobs.Queue
	Photos uploads.Store
	Log    *slog.Logger
}

const version = "0.1.0"

var startedAt = time.Now()

// New returns the full router: public health, auth and webhooks, everything else behind a token.
func New(d Deps) http.Handler {
	signer := auth.NewSigner(d.Cfg.JWTSecret)

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer, middleware.Timeout(30*time.Second))
	r.Use(cors(d.Cfg.CORSOrigins))

	r.Get("/health", func(w http.ResponseWriter, req *http.Request) {
		dbState := "up"
		if err := ping(req.Context(), d.DB); err != nil {
			dbState = "down"
			d.Log.Error("health: database unreachable", "err", err)
		}
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":        dbState == "up",
			"version":   version,
			"uptimeSec": int(time.Since(startedAt).Seconds()),
			"db":        dbState,
			"queue":     d.Queue.Mode(),
		})
	})

	r.Mount("/auth", auth.Routes(d.DB, signer, d.Cfg.AccessTokenTTL, d.Cfg.DeviceTokenTTL))
	// A photo is fetched by an <img> tag, which cannot carry a token; the random name is the secret.
	r.Get("/uploads/{name}", uploads.Download(d.Photos))
	r.Mount("/webhooks", ingest.Routes(d.DB, d.Queue, d.Cfg.WebhookSecret, d.Cfg.Env == "production", d.Log))

	r.Group(func(private chi.Router) {
		private.Use(signer.Middleware)

		private.Post("/uploads", uploads.Upload(d.Photos))
		private.Mount("/device-types", devicetypes.Routes(d.DB))
		private.Mount("/alerts", alerts.ItemRoutes(d.DB, d.Queue))

		private.Route("/distributors/{distributorId}", func(tenant chi.Router) {
			distributors.Register(tenant, d.DB)
			tenant.Mount("/outlets", outlets.Routes(d.DB))
			tenant.Mount("/devices", devices.Routes(d.DB))
			tenant.Mount("/employees", employees.Routes(d.DB))
			tenant.Mount("/technicians", technicians.Routes(d.DB))
			tenant.Mount("/contact-persons", contacts.Routes(d.DB))
			tenant.Mount("/alerts", alerts.TenantRoutes(d.DB, d.Queue))
			tenant.Mount("/tickets", tickets.Routes(d.DB, d.Queue))
			tenant.Mount("/readings", readings.Routes(d.DB))
			tenant.Mount("/stats", stats.Routes(d.DB))
			tenant.Mount("/integration", integration.Routes(d.DB))
		})
	})

	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		httpx.Fail(w, req, httpx.NewError("NOT_FOUND", http.StatusNotFound, "Route not found", req.Method+" "+req.URL.Path))
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, req *http.Request) {
		httpx.Fail(w, req, httpx.NewError("METHOD_NOT_ALLOWED", http.StatusMethodNotAllowed, "Method not allowed", req.Method+" "+req.URL.Path))
	})
	return r
}

func ping(ctx context.Context, db store.DB) error {
	if db == nil {
		return context.Canceled
	}
	return db.Ping(ctx)
}

// cors answers the browser preflight for the two frontends.
func cors(origins []string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if origin := req.Header.Get("Origin"); allowed[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Signature")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			}
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	}
}
