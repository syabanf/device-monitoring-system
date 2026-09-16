// Package jobs carries domain events from a request to the channels that deliver them.
// Services write an outbox row inside their transaction and signal the queue; nothing calls
// push or Telegram from inside a request.
package jobs

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/notify"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

type EventName string

const (
	AlertTriggered  EventName = "alert.triggered"
	AlertCleared    EventName = "alert.cleared"
	AlertResponded  EventName = "alert.responded"
	TicketCompleted EventName = "ticket.completed"
)

type Payload map[string]any

// Queue decouples the request from delivery. Inline is enough for local development; a Redis
// backed implementation drops in without touching services.
type Queue interface {
	Mode() string
	Enqueue(ctx context.Context, name EventName, payload Payload) error
	SetHandler(func(ctx context.Context) error)
	Close() error
}

type inlineQueue struct {
	handler func(ctx context.Context) error
}

// NewInlineQueue runs the dispatcher in the caller's goroutine, so one process serves everything.
func NewInlineQueue() Queue { return &inlineQueue{} }

func (q *inlineQueue) Mode() string { return "inline" }

func (q *inlineQueue) Enqueue(ctx context.Context, _ EventName, _ Payload) error {
	if q.handler == nil {
		return nil
	}
	return q.handler(ctx)
}

func (q *inlineQueue) SetHandler(h func(ctx context.Context) error) { q.handler = h }
func (q *inlineQueue) Close() error                                 { return nil }

// Emit records the event, then signals the queue. A crash in between replays the delivery
// instead of dropping it.
func Emit(ctx context.Context, db store.DB, q Queue, name EventName, payload Payload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := db.Exec(ctx, `INSERT INTO outbox_event (id, name, payload) VALUES ($1, $2, $3)`, httpx.NewID("evt"), string(name), body); err != nil {
		return err
	}
	return q.Enqueue(ctx, name, payload)
}

const maxAttempts = 5

// Dispatcher drains the outbox and hands each event to the notifier.
func Dispatcher(db store.DB, n notify.Notifier, log *slog.Logger) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		rows, err := db.Query(ctx, `SELECT id, name, payload FROM outbox_event
			WHERE processed_at IS NULL AND attempts < $1 ORDER BY at LIMIT 50`, maxAttempts)
		if err != nil {
			return err
		}
		type pending struct {
			id, name string
			payload  []byte
		}
		var batch []pending
		for rows.Next() {
			var p pending
			if err := rows.Scan(&p.id, &p.name, &p.payload); err != nil {
				rows.Close()
				return err
			}
			batch = append(batch, p)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}

		for _, p := range batch {
			var payload Payload
			if err := json.Unmarshal(p.payload, &payload); err != nil {
				log.Error("outbox payload is not json", "id", p.id, "err", err)
			}
			targets, err := targetsFor(ctx, db, payload)
			if err == nil {
				err = n.Send(ctx, p.name, payload, targets)
			}
			if err != nil {
				log.Error("outbox delivery failed", "id", p.id, "event", p.name, "err", err)
				_, _ = db.Exec(ctx, `UPDATE outbox_event SET attempts = attempts + 1 WHERE id = $1`, p.id)
				continue
			}
			if _, err := db.Exec(ctx, `UPDATE outbox_event SET processed_at = now() WHERE id = $1`, p.id); err != nil {
				return err
			}
		}
		return nil
	}
}

// Everyone registered at the outlet hears about it; the first responder closes the loop.
func targetsFor(ctx context.Context, db store.DB, payload Payload) ([]notify.Target, error) {
	outletID, _ := payload["outletId"].(string)
	if outletID == "" {
		return nil, nil
	}
	rows, err := db.Query(ctx, `
		SELECT e.id FROM employee e
		JOIN employee_outlet eo ON eo.employee_id = e.id
		WHERE eo.outlet_id = $1 AND e.registration_status = 'approved'`, outletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var targets []notify.Target
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		targets = append(targets, notify.Target{EmployeeID: id, Channels: []string{"app", "telegram"}})
	}
	return targets, rows.Err()
}
