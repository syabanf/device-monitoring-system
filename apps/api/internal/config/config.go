// Package config reads the environment once at boot and refuses to start when a required
// value is missing, so a half-configured service never accepts traffic.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env            string
	Port           int
	LogLevel       string
	DatabaseURL    string
	JWTSecret      []byte
	WebhookSecret  string
	CORSOrigins    []string
	AccessTokenTTL time.Duration
	DeviceTokenTTL time.Duration
	RedisURL       string
	UploadDir      string
}

func Load() (Config, error) {
	var missing []string
	required := func(key string, min int) string {
		v := os.Getenv(key)
		if len(v) < min {
			missing = append(missing, fmt.Sprintf("%s (needs at least %d characters)", key, min))
		}
		return v
	}

	cfg := Config{
		Env:           def("APP_ENV", "development"),
		LogLevel:      def("LOG_LEVEL", "info"),
		DatabaseURL:   required("DATABASE_URL", 1),
		WebhookSecret: required("WEBHOOK_SECRET", 8),
		RedisURL:      os.Getenv("REDIS_URL"),
		UploadDir:     def("UPLOAD_DIR", "./data/uploads"),
	}
	cfg.JWTSecret = []byte(required("JWT_SECRET", 32))

	port, err := strconv.Atoi(def("PORT", "3000"))
	if err != nil {
		missing = append(missing, "PORT (must be a number)")
	}
	cfg.Port = port

	for _, o := range strings.Split(def("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			cfg.CORSOrigins = append(cfg.CORSOrigins, o)
		}
	}

	if cfg.AccessTokenTTL, err = time.ParseDuration(def("ACCESS_TOKEN_TTL", "15m")); err != nil {
		missing = append(missing, "ACCESS_TOKEN_TTL (e.g. 15m)")
	}
	if cfg.DeviceTokenTTL, err = time.ParseDuration(def("DEVICE_TOKEN_TTL", "720h")); err != nil {
		missing = append(missing, "DEVICE_TOKEN_TTL (e.g. 720h)")
	}

	if len(missing) > 0 {
		return Config{}, fmt.Errorf("invalid environment, see apps/api/.env.example:\n  %s", strings.Join(missing, "\n  "))
	}
	return cfg, nil
}

func def(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
