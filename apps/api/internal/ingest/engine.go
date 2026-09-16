package ingest

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/alerts"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// Result is what the webhook answers with.
type Result struct {
	Accepted bool   `json:"accepted"`
	AlertID  *int64 `json:"alertId"`
	Reason   string `json:"reason,omitempty"`
}

type resolved struct {
	distributorID, outletID, deviceID, sensorID, sensorName string
	sensorType                                              domain.SensorType
}

var nonAlnum = regexp.MustCompile(`[^a-z0-9]`)

func norm(v string) string { return nonAlnum.ReplaceAllString(strings.ToLower(v), "") }

// Ingest opens a new alert, or closes the matching open one when the cloud reports a clear.
// A replay of the same external id returns the alert that already exists.
func Ingest(ctx context.Context, db store.DB, q jobs.Queue, e Event) (Result, error) {
	r, reason, err := resolve(ctx, db, e)
	if err != nil {
		return Result{}, err
	}
	if reason != "" {
		if _, err := db.Exec(ctx, `INSERT INTO unmatched_event (id, source, reason, raw) VALUES ($1,$2,$3,$4)`,
			httpx.NewID("unm"), e.Source, reason, e.Raw); err != nil {
			return Result{}, err
		}
		return Result{Reason: reason}, nil
	}

	if e.ExternalID != "" && e.Kind == "TRIGGERED" {
		var existing int64
		err := db.QueryRow(ctx, `SELECT id FROM alert WHERE external_alert_id = $1`, e.ExternalID).Scan(&existing)
		if err == nil {
			return Result{Accepted: true, AlertID: &existing}, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return Result{}, err
		}
	}

	if e.Kind == "CLEARED" {
		id, open, err := alerts.OpenOn(ctx, db, r.sensorID)
		if err != nil {
			return Result{}, err
		}
		if !open {
			return Result{Reason: "No open alert on this sensor to clear"}, nil
		}
		if err := alerts.Close(ctx, db, q, id, r.outletID, e.Value, e.At); err != nil {
			return Result{}, err
		}
		return Result{Accepted: true, AlertID: &id}, nil
	}

	id, err := alerts.Raise(ctx, db, q, alerts.Opening{
		ExternalID:    e.ExternalID,
		DistributorID: r.distributorID,
		OutletID:      r.outletID,
		DeviceID:      r.deviceID,
		SensorID:      r.sensorID,
		SensorName:    r.sensorName,
		SensorType:    r.sensorType,
		Category:      CategoryFor(r.sensorType),
		TriggerValue:  orDefault(e.Value, "-"),
		TriggerTime:   e.At,
		Message:       MessageFor(r.sensorType, e.Value),
	})
	if err != nil {
		return Result{}, err
	}
	return Result{Accepted: true, AlertID: &id}, nil
}

// resolve matches the event to master data: MAC first because it never changes, then the
// serial printed on the unit, then the outlet name the installer typed into the cloud.
func resolve(ctx context.Context, db store.DB, e Event) (resolved, string, error) {
	var r resolved
	err := db.QueryRow(ctx, `
		SELECT d.distributor_id, d.outlet_id, d.id FROM device d
		WHERE ($1 <> '' AND d.mac = $1) OR ($2 <> '' AND d.serial = $2)
		LIMIT 1`, e.MAC, e.DeviceSerial).Scan(&r.distributorID, &r.outletID, &r.deviceID)
	if errors.Is(err, pgx.ErrNoRows) {
		r, err = resolveByName(ctx, db, e.DeviceName)
		if errors.Is(err, pgx.ErrNoRows) {
			return resolved{}, "No device matches serial \"" + orDefault(e.DeviceSerial, "-") + "\", MAC \"" +
				orDefault(e.MAC, "-") + "\" or name \"" + e.DeviceName + "\"", nil
		}
	}
	if err != nil {
		return resolved{}, "", err
	}

	rows, err := db.Query(ctx, `SELECT id, name, type FROM sensor WHERE device_id = $1 ORDER BY port_kind, port_index`, r.deviceID)
	if err != nil {
		return resolved{}, "", err
	}
	defer rows.Close()

	type sensorRow struct {
		id, name string
		kind     domain.SensorType
	}
	var sensors []sensorRow
	for rows.Next() {
		var s sensorRow
		if err := rows.Scan(&s.id, &s.name, &s.kind); err != nil {
			return resolved{}, "", err
		}
		sensors = append(sensors, s)
	}
	if err := rows.Err(); err != nil {
		return resolved{}, "", err
	}
	if len(sensors) == 0 {
		return resolved{}, "Device has no sensors configured", nil
	}

	// Prefer an exact name, then a partial one, then the reported type, then the first sensor.
	wanted := norm(strings.SplitN(e.SensorName, "/", 2)[0])
	pick := sensors[0]
	best := 0
	for _, s := range sensors {
		switch {
		case wanted != "" && norm(s.name) == wanted:
			pick, best = s, 3
		case best < 2 && wanted != "" && (strings.Contains(wanted, norm(s.name)) || strings.Contains(norm(s.name), wanted)):
			pick, best = s, 2
		case best < 1 && s.kind == e.SensorType:
			pick, best = s, 1
		}
		if best == 3 {
			break
		}
	}
	r.sensorID, r.sensorName, r.sensorType = pick.id, pick.name, pick.kind
	return r, "", nil
}

func resolveByName(ctx context.Context, db store.DB, deviceName string) (resolved, error) {
	var r resolved
	if deviceName == "" {
		return r, pgx.ErrNoRows
	}
	err := db.QueryRow(ctx, `
		SELECT d.distributor_id, d.outlet_id, d.id FROM device d
		JOIN outlet o ON o.id = d.outlet_id
		WHERE position(lower(regexp_replace(o.name, '[^a-zA-Z0-9]', '', 'g')) in lower(regexp_replace($1, '[^a-zA-Z0-9]', '', 'g'))) > 0
		ORDER BY d.installed_at
		LIMIT 1`, deviceName).Scan(&r.distributorID, &r.outletID, &r.deviceID)
	return r, err
}
