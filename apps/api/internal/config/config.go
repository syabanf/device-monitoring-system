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
	CORSOrigins    []string
	AccessTokenTTL time.Duration
	DeviceTokenTTL time.Duration
	RedisURL       string
	UploadDir      string
	MQTT           MQTT
}

// MQTT points the AKCP subscriber at the broker the sensorProbe+ units publish to. An empty
// BrokerURL leaves the subscriber switched off, so no sensor data arrives.
type MQTT struct {
	BrokerURL   string
	ClientID    string
	TopicFilter string
	Username    string
	Password    string
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
		Env:         def("APP_ENV", "development"),
		LogLevel:    def("LOG_LEVEL", "info"),
		DatabaseURL: required("DATABASE_URL", 1),
		RedisURL:    os.Getenv("REDIS_URL"),
		UploadDir:   def("UPLOAD_DIR", "./data/uploads"),
	}
	cfg.JWTSecret = []byte(required("JWT_SECRET", 32))

	cfg.MQTT = MQTT{
		BrokerURL:   os.Getenv("MQTT_BROKER_URL"),
		ClientID:    def("MQTT_CLIENT_ID", clientIDFor(hostname())),
		TopicFilter: def("MQTT_TOPIC_FILTER", "spp/+/sensor/+/+"),
		Username:    os.Getenv("MQTT_USERNAME"),
		Password:    os.Getenv("MQTT_PASSWORD"),
	}

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

	// A dashboard session lasts a working day. Shorten it once refresh tokens exist, since
	// nothing renews a token today and the app drops the user at /login when it expires.
	if cfg.AccessTokenTTL, err = time.ParseDuration(def("ACCESS_TOKEN_TTL", "8h")); err != nil {
		missing = append(missing, "ACCESS_TOKEN_TTL (e.g. 8h)")
	}
	if cfg.DeviceTokenTTL, err = time.ParseDuration(def("DEVICE_TOKEN_TTL", "720h")); err != nil {
		missing = append(missing, "DEVICE_TOKEN_TTL (e.g. 720h)")
	}

	if len(missing) > 0 {
		return Config{}, fmt.Errorf("invalid environment, see apps/api/.env.example:\n  %s", strings.Join(missing, "\n  "))
	}
	return cfg, nil
}

// clientIDFor names the MQTT subscriber after the machine it runs on. The broker keeps one
// session per client id and drops the older connection when a second client arrives with the
// same id, so two instances sharing a fixed id knock each other off in a loop. A hostname stays
// the same across restarts, which keeps the persistent session the broker holds for us.
func clientIDFor(host string) string {
	host, _, _ = strings.Cut(host, ".")
	host = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' {
			return r
		}
		return '-'
	}, host)
	if host == "" {
		return "akcp-ingestor"
	}
	return "akcp-" + host
}

func hostname() string {
	host, _ := os.Hostname()
	return host
}

func def(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
