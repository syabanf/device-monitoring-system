package akcp

import (
	"context"
	"log/slog"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// Config is what the environment says about the broker the units publish to. An empty
// BrokerURL leaves the subscriber switched off, which is how a deployment without AKCP
// hardware runs.
type Config struct {
	BrokerURL   string
	ClientID    string
	TopicFilter string
	Username    string
	Password    string
	// QueueSize bounds the buffer between the broker and the database. A burst beyond it is
	// dropped and counted rather than held, so a slow database cannot grow the process.
	QueueSize int
}

// Status is what the Integration page shows about the connection.
type Status struct {
	Enabled       bool       `json:"enabled"`
	Connected     bool       `json:"connected"`
	BrokerURL     string     `json:"brokerUrl"`
	ClientID      string     `json:"clientId"`
	TopicFilter   string     `json:"topicFilter"`
	Received      int64      `json:"received"`
	Stored        int64      `json:"stored"`
	Unmatched     int64      `json:"unmatched"`
	Dropped       int64      `json:"dropped"`
	LastMessageAt *time.Time `json:"lastMessageAt"`
	LastError     string     `json:"lastError,omitempty"`
}

type delivery struct {
	topic    string
	body     []byte
	retained bool
	at       time.Time
}

// Worker holds the one connection the whole fleet publishes into. Messages arrive on the
// broker's callback goroutine, so the handler only buffers them and a single drainer writes
// them to the database in the order they arrived.
type Worker struct {
	cfg    Config
	db     store.DB
	q      jobs.Queue
	log    *slog.Logger
	client mqtt.Client
	queue  chan delivery
	done   chan struct{}

	mu sync.Mutex
	st Status
}

func New(cfg Config, db store.DB, q jobs.Queue, log *slog.Logger) *Worker {
	if cfg.TopicFilter == "" {
		cfg.TopicFilter = TopicFilter
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 1000
	}
	return &Worker{
		cfg: cfg, db: db, q: q, log: log,
		queue: make(chan delivery, cfg.QueueSize),
		done:  make(chan struct{}),
		st: Status{
			Enabled: true, BrokerURL: cfg.BrokerURL, ClientID: cfg.ClientID, TopicFilter: cfg.TopicFilter,
		},
	}
}

// Start connects and subscribes. It returns as soon as the client is running: the broker may
// still be booting next to us, and the client keeps retrying, so the API never waits for it.
func (w *Worker) Start(ctx context.Context) {
	opts := mqtt.NewClientOptions().
		AddBroker(w.cfg.BrokerURL).
		SetClientID(w.cfg.ClientID).
		SetUsername(w.cfg.Username).
		SetPassword(w.cfg.Password).
		// A persistent session lets the broker hold QoS 1 messages while the API restarts.
		SetCleanSession(false).
		SetProtocolVersion(4).
		SetKeepAlive(60 * time.Second).
		SetConnectTimeout(10 * time.Second).
		SetConnectRetry(true).
		SetConnectRetryInterval(5 * time.Second).
		SetAutoReconnect(true)

	opts.SetOnConnectHandler(func(c mqtt.Client) {
		token := c.Subscribe(w.cfg.TopicFilter, 1, w.receive)
		token.Wait()
		if err := token.Error(); err != nil {
			w.fail("subscribe", err)
			return
		}
		w.mark(func(s *Status) { s.Connected, s.LastError = true, "" })
		w.log.Info("akcp subscriber connected", "broker", w.cfg.BrokerURL, "filter", w.cfg.TopicFilter)
		w.record(ctx, "connected", 200, 0, "Subscribed to "+w.cfg.TopicFilter)
	})
	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		w.fail("connection lost", err)
		w.record(ctx, "disconnected", 503, 0, "Connection lost: "+err.Error())
	})

	w.client = mqtt.NewClient(opts)
	w.client.Connect()
	go w.drain(ctx)
}

// Stop drains what is already buffered before it closes the connection, so a restart does not
// lose messages the broker considers delivered.
func (w *Worker) Stop() {
	close(w.queue)
	select {
	case <-w.done:
	case <-time.After(10 * time.Second):
		w.log.Warn("akcp subscriber drained on a timer, some messages were dropped")
	}
	if w.client != nil {
		w.client.Disconnect(250)
	}
	w.mark(func(s *Status) { s.Connected = false })
}

func (w *Worker) Status() Status {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.st
}

// receive runs on the client's callback goroutine and must not block: a full buffer means the
// database cannot keep up, and dropping the message is better than stalling the connection.
func (w *Worker) receive(_ mqtt.Client, m mqtt.Message) {
	d := delivery{topic: m.Topic(), body: m.Payload(), retained: m.Retained(), at: time.Now().UTC()}
	select {
	case w.queue <- d:
	default:
		w.mark(func(s *Status) { s.Dropped++ })
		w.log.Warn("akcp queue is full, message dropped", "topic", d.topic)
	}
}

func (w *Worker) drain(ctx context.Context) {
	defer close(w.done)
	for d := range w.queue {
		w.process(ctx, d)
	}
}

func (w *Worker) process(ctx context.Context, d delivery) {
	started := time.Now()
	out, err := Handle(ctx, w.db, w.q, d.topic, d.body, d.retained, d.at)
	ms := int(time.Since(started).Milliseconds())
	if err != nil {
		w.fail("handle "+d.topic, err)
		w.record(ctx, d.topic, 500, ms, err.Error())
		return
	}

	at := d.at
	w.mark(func(s *Status) {
		s.Received++
		s.LastMessageAt = &at
		if out.Stored {
			s.Stored++
		}
		if !out.Matched() {
			s.Unmatched++
		}
	})

	w.log.Info("akcp message processed", "topic", d.topic, "sensorId", out.SensorID, "stored", out.Stored,
		"retained", d.retained, "reason", out.Reason, "ms", ms)

	// One row per message would bury the request log under telemetry, so only the messages an
	// admin would look for land there: the ones that moved an alert or matched nothing.
	switch {
	case !out.Matched():
		w.record(ctx, d.topic, 422, ms, out.Reason)
	case out.Raised != nil:
		w.record(ctx, d.topic, 202, ms, "Alert raised on "+out.SensorID)
	case out.Cleared != nil:
		w.record(ctx, d.topic, 202, ms, "Alert cleared on "+out.SensorID)
	}
}

func (w *Worker) record(ctx context.Context, path string, status, ms int, summary string) {
	if _, err := w.db.Exec(ctx, `
		INSERT INTO request_log (id, direction, channel, method, path, status, ms, summary)
		VALUES ($1,'inbound','akcp','MQTT',$2,$3,$4,$5)`,
		httpx.NewID("log"), path, status, ms, summary); err != nil {
		w.log.Error("akcp request log", "err", err)
	}
}

func (w *Worker) fail(what string, err error) {
	w.log.Error("akcp subscriber", "what", what, "err", err)
	w.mark(func(s *Status) { s.Connected, s.LastError = false, what+": "+err.Error() })
}

func (w *Worker) mark(change func(*Status)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	change(&w.st)
}
