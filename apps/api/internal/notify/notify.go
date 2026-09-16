// Package notify hides the delivery channels behind one interface so services stay
// channel-agnostic.
package notify

import (
	"context"
	"log/slog"
)

type Target struct {
	EmployeeID string   `json:"employeeId"`
	Channels   []string `json:"channels"`
}

type Notifier interface {
	Name() string
	Send(ctx context.Context, event string, payload map[string]any, targets []Target) error
}

// Noop is the development default. Swap in FCM and Telegram once credentials exist.
type Noop struct{ Log *slog.Logger }

func (n Noop) Name() string { return "noop" }

func (n Noop) Send(_ context.Context, event string, payload map[string]any, targets []Target) error {
	n.Log.Info("notify (noop)", "event", event, "targets", len(targets), "payload", payload)
	return nil
}
