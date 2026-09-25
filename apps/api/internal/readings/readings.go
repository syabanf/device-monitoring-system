// Package readings serves the sensor time series the dashboard, analysis, shopfloor and report
// screens draw, and stores the samples the AKCP subscriber hands it.
package readings

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/alerts"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
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
	db  store.DB
	ctx auth.Ctx
}

func NewService(db store.DB, c auth.Ctx) Service {
	return Service{db: db, ctx: c}
}

// guard turns an out-of-scope outlet filter into a refusal, so an employee who asks for another
// outlet learns the request was out of bounds instead of reading an empty chart.
func (s Service) guard(outletID string) error {
	if outletID != "" && !s.ctx.CoversOutlet(outletID) {
		return httpx.Forbidden("Outlet is outside your registration")
	}
	return nil
}

// Latest returns the newest reading of every sensor the session may see, which is what the
// dashboard tiles and the floor plan need on load.
func (s Service) Latest(ctx context.Context, outletID string) ([]Reading, error) {
	if err := s.guard(outletID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT ON (r.sensor_id) r.sensor_id, r.at, r.temperature_c, r.humidity_pct
		FROM reading r
		JOIN sensor s ON s.id = r.sensor_id
		WHERE s.distributor_id = $1
		  AND ($2 = '' OR s.outlet_id = $2)
		  AND ($3::text[] IS NULL OR s.outlet_id = ANY($3))
		ORDER BY r.sensor_id, r.at DESC`, s.ctx.Tenant, outletID, s.ctx.OutletScope())
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
	if err := s.guard(o.OutletID); err != nil {
		return nil, err
	}
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
			LIMIT $7`, s.ctx.Tenant, o.SensorID, o.OutletID, s.ctx.OutletScope(), o.From, o.To, o.Limit)
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
		LIMIT $8`, s.ctx.Tenant, o.SensorID, o.OutletID, s.ctx.OutletScope(), o.From, o.To, o.Bucket.Seconds(), o.Limit)
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

// Push is a batch of samples from one unit, named by the MAC master data holds for it. Storing
// it also keeps the device row marked online, which is what the health score reads.
type Push struct {
	MAC      string
	Readings []PushReading
}

type PushReading struct {
	SensorID     string
	At           *time.Time
	TemperatureC float64
	HumidityPct  float64
}

type PushResult struct {
	Accepted int    `json:"accepted"`
	DeviceID string `json:"deviceId"`
	Reason   string `json:"reason,omitempty"`
	// Raised and Cleared are the alerts the limits opened and closed for this push.
	Raised  []int64 `json:"raised,omitempty"`
	Cleared []int64 `json:"cleared,omitempty"`
}

// sensorRow is what the limit check needs about the sensor a sample belongs to.
type sensorRow struct {
	id, name, deviceID, outletID, distributorID string
	kind                                        domain.SensorType
	thresholds                                  *domain.SensorThresholds
}

// Store writes the samples a unit sent, then judges each sensor's newest sample against the
// limits an admin set for it.
func Store(ctx context.Context, db store.DB, q jobs.Queue, p Push) (PushResult, error) {
	var deviceID string
	err := db.QueryRow(ctx, `SELECT id FROM device WHERE mac = $1`, p.MAC).Scan(&deviceID)
	if err != nil {
		return PushResult{Reason: "No device matches MAC \"" + p.MAC + "\""}, nil
	}

	sensors, err := sensorsOf(ctx, db, deviceID)
	if err != nil {
		return PushResult{}, err
	}

	now := time.Now().UTC()
	result := PushResult{DeviceID: deviceID}
	newest := map[string]Reading{}
	for _, r := range p.Readings {
		sensorID := r.SensorID
		sensor, ok := sensors[sensorID]
		if !ok {
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
		result.Accepted++
		if held, seen := newest[sensor.id]; !seen || at.After(held.At) {
			newest[sensor.id] = Reading{SensorID: sensor.id, At: at, TemperatureC: r.TemperatureC, HumidityPct: r.HumidityPct}
		}
	}

	for id, sample := range newest {
		raised, cleared, err := judge(ctx, db, q, sensors[id], sample)
		if err != nil {
			return PushResult{}, err
		}
		if raised != nil {
			result.Raised = append(result.Raised, *raised)
		}
		if cleared != nil {
			result.Cleared = append(result.Cleared, *cleared)
		}
	}

	if _, err := db.Exec(ctx, `UPDATE device SET last_push_at = $2, status = 'online' WHERE id = $1`, deviceID, now); err != nil {
		return PushResult{}, err
	}
	return result, nil
}

func sensorsOf(ctx context.Context, db store.DB, deviceID string) (map[string]sensorRow, error) {
	rows, err := db.Query(ctx, `SELECT id, name, device_id, outlet_id, distributor_id, type, thresholds FROM sensor WHERE device_id = $1`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sensors := map[string]sensorRow{}
	for rows.Next() {
		var s sensorRow
		var thresholds []byte
		if err := rows.Scan(&s.id, &s.name, &s.deviceID, &s.outletID, &s.distributorID, &s.kind, &thresholds); err != nil {
			return nil, err
		}
		if len(thresholds) > 0 {
			if err := json.Unmarshal(thresholds, &s.thresholds); err != nil {
				return nil, err
			}
		}
		sensors[s.id] = s
	}
	return sensors, rows.Err()
}

// judge opens an alert when a sample leaves the sensor's band and resolves the open one when a
// later sample comes back inside it. One open alert per sensor, so a unit pushing every five
// minutes never floods the outlet with duplicates.
func judge(ctx context.Context, db store.DB, q jobs.Queue, s sensorRow, sample Reading) (raised, cleared *int64, err error) {
	if s.thresholds == nil {
		return nil, nil, nil
	}
	breach := s.thresholds.Check(sample.TemperatureC, sample.HumidityPct, s.kind == domain.SensorTempHumidity)
	openID, open, err := alerts.OpenOn(ctx, db, s.id)
	if err != nil {
		return nil, nil, err
	}

	switch {
	case breach != nil && !open:
		id, err := alerts.Raise(ctx, db, q, alerts.Opening{
			DistributorID: s.distributorID,
			OutletID:      s.outletID,
			DeviceID:      s.deviceID,
			SensorID:      s.id,
			SensorName:    s.name,
			SensorType:    s.kind,
			Category:      domain.CategoryComfort,
			TriggerValue:  breach.Reading(),
			TriggerTime:   sample.At,
			Message:       breach.Message(),
		})
		if err != nil {
			return nil, nil, err
		}
		return &id, nil, nil
	case breach == nil && open:
		if err := alerts.Close(ctx, db, q, openID, s.outletID, formatSample(s.kind, sample), sample.At); err != nil {
			return nil, nil, err
		}
		return nil, &openID, nil
	}
	return nil, nil, nil
}

func formatSample(kind domain.SensorType, r Reading) string {
	if kind == domain.SensorTempHumidity {
		return fmt.Sprintf("%.2f °C / %.1f %%RH", r.TemperatureC, r.HumidityPct)
	}
	return fmt.Sprintf("%.2f °C", r.TemperatureC)
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
