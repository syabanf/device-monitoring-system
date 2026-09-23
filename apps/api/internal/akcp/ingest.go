package akcp

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/alerts"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/ingest"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/readings"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// measure is the reading a compound id carries. The units ship two sensors on the probe, and
// the manual addresses them by fixed keys.
type measure string

const (
	temperature measure = "temperature"
	humidity    measure = "humidity"
)

// compoundMeasures is the registry an installer inherits when nobody set external_key on the
// sensor row. Anything else needs the explicit binding.
var compoundMeasures = map[string]measure{
	"0.1.0.5.0": temperature,
	"0.1.0.5.1": humidity,
}

// Outcome is what one message did. The worker logs it and the tests read it.
type Outcome struct {
	// Reason is empty when the message landed on a sensor, and says why it did not otherwise.
	Reason   string
	SensorID string
	Stored   bool
	Raised   *int64
	Cleared  *int64
}

// Matched reports whether the message reached a sensor.
func (o Outcome) Matched() bool { return o.Reason == "" }

type target struct {
	sensorID, sensorName              string
	deviceID, outletID, distributorID string
	mac                               string
	kind                              domain.SensorType
}

// Handle turns one published message into stored data: it matches the topic to a sensor, keeps
// the value as a reading and lets the status code open or close an alert. A message that
// matches nothing is parked in unmatched_event, the same place the webhook parks its misses,
// so an installer can see what the unit sent before the mapping existed.
func Handle(ctx context.Context, db store.DB, q jobs.Queue, topic string, body []byte, retained bool, arrived time.Time) (Outcome, error) {
	t, err := ParseTopic(topic)
	if err != nil {
		return park(ctx, db, err.Error(), topic, body)
	}
	p, err := ParsePayload(body, arrived)
	if err != nil {
		return park(ctx, db, err.Error(), topic, body)
	}

	tgt, reason, err := resolve(ctx, db, t)
	if err != nil {
		return Outcome{}, err
	}
	if reason != "" {
		return park(ctx, db, reason, topic, body)
	}

	out := Outcome{SensorID: tgt.sensorID}
	value := ""
	if p.Value != nil {
		// When the unit states a verdict, that verdict decides the alert on its own. Only a bare
		// value is judged against the limits an admin set here, the way the Room Alert push is.
		stored, formatted, err := store1(ctx, db, q, tgt, t.Compound, *p.Value, p.At, retained, p.Status == nil)
		if err != nil {
			return Outcome{}, err
		}
		out.Stored, value = stored, formatted
	}
	if p.Status != nil {
		if err := judge(ctx, db, q, tgt, *p.Status, value, p.At, &out); err != nil {
			return Outcome{}, err
		}
	}
	return out, nil
}

// resolve finds the sensor the message belongs to: the unit's MAC picks the device, and the
// compound id picks the port. An explicit external_key wins over the registry, so an installer
// can bind a key the registry does not know.
func resolve(ctx context.Context, db store.DB, t Topic) (target, string, error) {
	rows, err := db.Query(ctx, `
		SELECT s.id, s.name, s.type, coalesce(s.external_key, ''), d.id, d.outlet_id, d.distributor_id, d.mac
		FROM sensor s JOIN device d ON d.id = s.device_id
		WHERE upper(regexp_replace(d.mac, '[^0-9A-Za-z]', '', 'g')) = upper($1) AND s.enabled
		ORDER BY s.port_kind, s.port_index`, t.DeviceMAC)
	if err != nil {
		return target{}, "", err
	}
	defer rows.Close()

	type row struct {
		target
		externalKey string
	}
	var candidates []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.sensorID, &r.sensorName, &r.kind, &r.externalKey,
			&r.deviceID, &r.outletID, &r.distributorID, &r.mac); err != nil {
			return target{}, "", err
		}
		candidates = append(candidates, r)
	}
	if err := rows.Err(); err != nil {
		return target{}, "", err
	}
	if len(candidates) == 0 {
		return target{}, fmt.Sprintf("No enabled sensor sits behind a device with MAC %q", t.DeviceMAC), nil
	}

	for _, c := range candidates {
		if c.externalKey == t.Compound {
			return c.target, "", nil
		}
	}
	want, known := compoundMeasures[t.Compound]
	if !known {
		return target{}, fmt.Sprintf("Sensor key %q is bound to no sensor on this device", t.Compound), nil
	}
	for _, c := range candidates {
		if carries(c.kind, want) {
			return c.target, "", nil
		}
	}
	return target{}, fmt.Sprintf("Device has no %s sensor for key %q", want, t.Compound), nil
}

// carries reports whether a sensor reads the measurement a compound id carries.
func carries(kind domain.SensorType, m measure) bool {
	switch m {
	case temperature:
		return kind == domain.SensorTemperature || kind == domain.SensorTempHumidity
	case humidity:
		return kind == domain.SensorTempHumidity
	}
	return false
}

// store1 writes one published value. A reading row holds a temperature and a humidity while the
// unit publishes one of them at a time, so the counterpart keeps the value it last had, which
// is also what lets the limits judge the pair.
func store1(ctx context.Context, db store.DB, q jobs.Queue, tgt target, compound string, value float64, at time.Time, retained, judged bool) (bool, string, error) {
	lastTemp, lastHum, lastAt, err := latest(ctx, db, tgt.sensorID)
	if err != nil {
		return false, "", err
	}
	// A broker replays retained messages on every reconnect. Older state must not overwrite
	// what the unit has published since, though the value still describes the message.
	m := measureOf(tgt, compound)
	formatted := format(m, value)
	if retained && !lastAt.IsZero() && !at.After(lastAt) {
		return false, formatted, nil
	}

	temp, hum := lastTemp, lastHum
	if m == humidity {
		hum = value
	} else {
		temp = value
	}

	if judged {
		sample := readings.PushReading{SensorID: tgt.sensorID, At: &at, TemperatureC: temp, HumidityPct: hum}
		if _, err := readings.Store(ctx, db, q, readings.Push{MAC: tgt.mac, Readings: []readings.PushReading{sample}}); err != nil {
			return false, "", err
		}
		return true, formatted, nil
	}

	if _, err := db.Exec(ctx, `
		INSERT INTO reading (sensor_id, at, temperature_c, humidity_pct) VALUES ($1,$2,$3,$4)
		ON CONFLICT (sensor_id, at) DO UPDATE SET temperature_c = excluded.temperature_c, humidity_pct = excluded.humidity_pct`,
		tgt.sensorID, at, temp, hum); err != nil {
		return false, "", err
	}
	// Publishing is also how the fleet stays marked online, which the health score reads.
	if _, err := db.Exec(ctx, `UPDATE device SET last_push_at = $2, status = 'online' WHERE id = $1`,
		tgt.deviceID, time.Now().UTC()); err != nil {
		return false, "", err
	}
	return true, formatted, nil
}

// measureOf says which half of the reading a value belongs to. An explicit binding on a
// temperature-only sensor cannot mean humidity, so the sensor type decides when the registry
// does not know the key.
func measureOf(tgt target, compound string) measure {
	if m, ok := compoundMeasures[compound]; ok && carries(tgt.kind, m) {
		return m
	}
	return temperature
}

func format(m measure, value float64) string {
	if m == humidity {
		return fmt.Sprintf("%.1f %%RH", value)
	}
	return fmt.Sprintf("%.2f °C", value)
}

func latest(ctx context.Context, db store.DB, sensorID string) (temp, hum float64, at time.Time, err error) {
	err = db.QueryRow(ctx, `SELECT temperature_c, humidity_pct, at FROM reading WHERE sensor_id = $1
		ORDER BY at DESC LIMIT 1`, sensorID).Scan(&temp, &hum, &at)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, time.Time{}, nil
	}
	return temp, hum, at, err
}

// judge acts on the status code the unit reported. The unit watches its own limits, so a
// warning or a critical opens an alert even when the value still sits inside the limits an
// admin set here, and SENSORNORMAL closes the one that is open.
func judge(ctx context.Context, db store.DB, q jobs.Queue, tgt target, code int, value string, at time.Time, out *Outcome) error {
	openID, open, err := alerts.OpenOn(ctx, db, tgt.sensorID)
	if err != nil {
		return err
	}
	switch {
	case alarms[code] && !open:
		id, err := alerts.Raise(ctx, db, q, alerts.Opening{
			ExternalID:    fmt.Sprintf("akcp-%s-%s-%d", tgt.sensorID, at.UTC().Format(time.RFC3339), code),
			DistributorID: tgt.distributorID,
			OutletID:      tgt.outletID,
			DeviceID:      tgt.deviceID,
			SensorID:      tgt.sensorID,
			SensorName:    tgt.sensorName,
			SensorType:    tgt.kind,
			Category:      ingest.CategoryFor(tgt.kind),
			TriggerValue:  orDash(value),
			TriggerTime:   at,
			Message:       "Unit reported " + StatusLabel(code),
		})
		if err != nil {
			return err
		}
		out.Raised = &id
	case code == 2 && open:
		if err := alerts.Close(ctx, db, q, openID, tgt.outletID, value, at); err != nil {
			return err
		}
		out.Cleared = &openID
	}
	return nil
}

func orDash(v string) string {
	if v == "" {
		return "-"
	}
	return v
}

// park keeps a message nobody could place, with the topic in front of the body so the
// Integration page shows what the unit addressed.
func park(ctx context.Context, db store.DB, reason, topic string, body []byte) (Outcome, error) {
	raw := topic + " " + string(body)
	_, err := db.Exec(ctx, `INSERT INTO unmatched_event (id, source, reason, raw) VALUES ($1,'akcp',$2,$3)`,
		httpx.NewID("unm"), reason, raw)
	return Outcome{Reason: reason}, err
}
