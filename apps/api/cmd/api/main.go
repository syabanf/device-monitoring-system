// Command api serves the monitoring HTTP API.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/akcp"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/config"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/notify"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/server"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/uploads"
)

func main() {
	migrateOnly := flag.Bool("migrate", false, "apply migrations and exit")
	health := flag.Bool("health", false, "ask the running server for /health and exit 0 when it answers")
	flag.Parse()

	if *health {
		if err := probe(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	if err := run(*migrateOnly); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// probe backs the container health check. The image carries no shell, so the binary asks itself.
func probe() error {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	client := http.Client{Timeout: 3 * time.Second}
	res, err := client.Get("http://127.0.0.1:" + port + "/health")
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("health answered %d", res.StatusCode)
	}
	return nil
}

func run(migrateOnly bool) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: levelOf(cfg.LogLevel)}))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := store.Migrate(ctx, db); err != nil {
		return err
	}
	if migrateOnly {
		log.Info("migrations applied")
		return nil
	}

	photos, err := uploads.NewDisk(cfg.UploadDir)
	if err != nil {
		return err
	}

	queue := jobs.NewInlineQueue()
	queue.SetHandler(jobs.Dispatcher(db, notify.Noop{Log: log}, log))
	defer func() { _ = queue.Close() }()

	// The AKCP units publish over MQTT instead of calling a webhook, so the process holds one
	// subscription to their broker for the whole fleet.
	var mqttStatus func() akcp.Status
	if cfg.MQTT.BrokerURL != "" {
		worker := akcp.New(akcp.Config{
			BrokerURL:   cfg.MQTT.BrokerURL,
			ClientID:    cfg.MQTT.ClientID,
			TopicFilter: cfg.MQTT.TopicFilter,
			Username:    cfg.MQTT.Username,
			Password:    cfg.MQTT.Password,
		}, db, queue, log)
		worker.Start(context.WithoutCancel(ctx))
		defer worker.Stop()
		mqttStatus = worker.Status
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           server.New(server.Deps{Cfg: cfg, DB: db, Queue: queue, Photos: photos, Log: log, MQTT: mqttStatus}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Info("listening", "port", cfg.Port, "env", cfg.Env, "queue", queue.Mode())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server stopped", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func levelOf(name string) slog.Level {
	switch name {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error", "fatal":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
