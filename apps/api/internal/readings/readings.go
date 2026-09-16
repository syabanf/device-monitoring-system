// Package readings serves the sensor time series the dashboard, analysis, shopfloor and report
// screens draw, and accepts the periodic push the Room Alert units send.
package readings

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// Reading mirrors packages/types.
type Reading struct {
	SensorID     string    `json:"sensorId"`
	At           time.Time `json:"at"`
	TemperatureC float64   `json:"temperatureC"`
	HumidityPct  float64   `json:"humidityPct"`
}

// Bucket is an averaged slice of the series, which is what the trend charts draw.
type Bucket struct {
	// SensorID is set on raw rows and empty once samples are averaged across sensors.
	SensorID     string    `json:"sensorId,omitempty"`
	At           time.Time `json:"at"`
	TemperatureC float64   `json:"temperatureC"`
	HumidityPct  float64   `json:"humidityPct"`
	Samples      int       `json:"samples"`
}

type Service struct {
	db     store.DB
	tenant string
	scope  []string
}

func NewService(db store.DB, c auth.Ctx) Service {
	return Service{db: db, tenant: c.Tenant, scope: c.OutletScope()}
}

// Latest returns the newest reading of every sensor the session may see, which is what the
// dashboard tiles and the floor plan need on load.
func (s Service) Latest(ctx context.Context, outletID string) ([]Reading, error) {
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT ON (r.sensor_id) r.sensor_id, r.at, r.temperature_c, r.humidity_pct
		FROM reading r
		JOIN sensor s ON s.id = r.sensor_id
		WHERE s.distributor_id = $1
		  AND ($2 = '' OR s.outlet_id = $2)
		  AND ($3::text[] IS NULL OR s.outlet_id = ANY($3))
		ORDER BY r.sensor_id, r.at DESC`, s.tenant, outletID, s.scope)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collect(rows)
}

type SeriesOpts struct {
	SensorID string
	OutletID string
	From     time.Time
	To       time.Time
	Bucket   time.Duration
	Limit    int
}

// Series returns raw rows, or averaged buckets when the caller asks for them. Bucketing keeps
// a 30 day report from shipping a quarter of a million rows to the browser.
func (s Service) Series(ctx context.Context, o SeriesOpts) ([]Bucket, error) {
	if o.Bucket <= 0 {
		rows, err := s.db.Query(ctx, `
			SELECT r.sensor_id, r.at, r.temperature_c, r.humidity_pct
			FROM reading r JOIN sensor s ON s.id = r.sensor_id
			WHERE s.distributor_id = $1
			  AND ($2 = '' OR r.sensor_id = $2)
			  AND ($3 = '' OR s.outlet_id = $3)
			  AND ($4::text[] IS NULL OR s.outlet_id = ANY($4))
			  AND r.at >= $5 AND r.at < $6
			ORDER BY r.at
			LIMIT $7`, s.tenant, o.SensorID, o.OutletID, s.scope, o.From, o.To, o.Limit)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		raw, err := collect(rows)
		if err != nil {
			return nil, err
		}
		out := make([]Bucket, len(raw))
		for i, r := range raw {
			out[i] = Bucket{SensorID: r.SensorID, At: r.At, TemperatureC: r.TemperatureC, HumidityPct: r.HumidityPct, Samples: 1}
		}
		return out, nil
	}

	rows, err := s.db.Query(ctx, `
		SELECT to_timestamp(floor(extract(epoch FROM r.at) / $7) * $7) AS bucket,
		       avg(r.temperature_c), avg(r.humidity_pct), count(*)
		FROM reading r JOIN sensor s ON s.id = r.sensor_id
		WHERE s.distributor_id = $1
		  AND ($2 = '' OR r.sensor_id = $2)
		  AND ($3 = '' OR s.outlet_id = $3)
		  AND ($4::text[] IS NULL OR s.outlet_id = ANY($4))
		  AND r.at >= $5 AND r.at < $6
		GROUP BY bucket
		ORDER BY bucket
		LIMIT $8`, s.tenant, o.SensorID, o.OutletID, s.scope, o.From, o.To, o.Bucket.Seconds(), o.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Bucket{}
	for rows.Next() {
		var b Bucket
		if err := rows.Scan(&b.At, &b.TemperatureC, &b.HumidityPct, &b.Samples); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// Push is the periodic status the units send: it stores the samples and keeps the device row
// marked online, which is what the health score reads.
type Push struct {
	DeviceSerial string        `json:"deviceSerial"`
	MAC          string        `json:"mac"`
	Readings     []PushReading `json:"readings"`
}

type PushReading struct {
	SensorID     string     `json:"sensorId"`
	SensorName   string     `json:"sensorName"`
	At           *time.Time `json:"at"`
	TemperatureC float64    `json:"temperatureC"`
	HumidityPct  float64    `json:"humidityPct"`
}

func (p Push) Validate() error {
	if strings.TrimSpace(p.DeviceSerial) == "" && strings.TrimSpace(p.MAC) == "" {
		return fmt.Errorf("deviceSerial or mac is required")
	}
	if len(p.Readings) == 0 {
		return fmt.Errorf("readings must hold at least one sample")
	}
	return nil
}

type PushResult struct {
	Accepted int    `json:"accepted"`
	DeviceID string `json:"deviceId"`
	Reason   string `json:"reason,omitempty"`
}

// Store writes the samples the unit pushed. It resolves the sensor by id or by name so an
// installer never has to copy ids from the dashboard into the device.
func Store(ctx context.Context, db store.DB, p Push) (PushResult, error) {
	var deviceID string
	err := db.QueryRow(ctx, `SELECT id FROM device WHERE ($1 <> '' AND serial = $1) OR ($2 <> '' AND mac = $2) LIMIT 1`,
		p.DeviceSerial, strings.ToUpper(p.MAC)).Scan(&deviceID)
	if err != nil {
		return PushResult{Reason: "No device matches serial \"" + p.DeviceSerial + "\" or MAC \"" + p.MAC + "\""}, nil
	}

	byName := map[string]string{}
	known := map[string]bool{}
	rows, err := db.Query(ctx, `SELECT id, name FROM sensor WHERE device_id = $1`, deviceID)
	if err != nil {
		return PushResult{}, err
	}
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			rows.Close()
			return PushResult{}, err
		}
		byName[strings.ToLower(name)] = id
		known[id] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return PushResult{}, err
	}

	now := time.Now().UTC()
	accepted := 0
	for _, r := range p.Readings {
		sensorID := r.SensorID
		if sensorID == "" {
			sensorID = byName[strings.ToLower(r.SensorName)]
		}
		if !known[sensorID] {
			continue // the unit reported a sensor this device does not have
		}
		at := now
		if r.At != nil {
			at = *r.At
		}
		if _, err := db.Exec(ctx, `
			INSERT INTO reading (sensor_id, at, temperature_c, humidity_pct) VALUES ($1,$2,$3,$4)
			ON CONFLICT (sensor_id, at) DO UPDATE SET temperature_c = excluded.temperature_c, humidity_pct = excluded.humidity_pct`,
			sensorID, at, r.TemperatureC, r.HumidityPct); err != nil {
			return PushResult{}, err
		}
		accepted++
	}

	if _, err := db.Exec(ctx, `UPDATE device SET last_push_at = $2, status = 'online' WHERE id = $1`, deviceID, now); err != nil {
		return PushResult{}, err
	}
	return PushResult{Accepted: accepted, DeviceID: deviceID}, nil
}

func collect(rows pgx.Rows) ([]Reading, error) {
	out := []Reading{}
	for rows.Next() {
		var r Reading
		if err := rows.Scan(&r.SensorID, &r.At, &r.TemperatureC, &r.HumidityPct); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Routes mounts under /distributors/{distributorId}/readings.
func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()

	r.Get("/latest", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		items, err := NewService(db, c).Latest(req.Context(), req.URL.Query().Get("outletId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[Reading]{Items: items})
	})

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		q := req.URL.Query()
		to := parseTime(q.Get("to"), time.Now().UTC())
		items, err := NewService(db, c).Series(req.Context(), SeriesOpts{
			SensorID: q.Get("sensorId"),
			OutletID: q.Get("outletId"),
			From:     parseTime(q.Get("from"), to.Add(-24*time.Hour)),
			To:       to,
			Bucket:   parseBucket(q.Get("bucket")),
			Limit:    httpx.Limit(req, 500, 5000),
		})
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[Bucket]{Items: items})
	})

	return r
}

func parseTime(v string, fallback time.Time) time.Time {
	if v == "" {
		return fallback
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		if t, err := time.Parse(layout, v); err == nil {
			return t
		}
	}
	return fallback
}

func parseBucket(v string) time.Duration {
	switch v {
	case "hour":
		return time.Hour
	case "day":
		return 24 * time.Hour
	case "15m":
		return 15 * time.Minute
	default:
		return 0
	}
}
