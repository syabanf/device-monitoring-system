package alerts

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// Opening is one alert about to be written. Both the Room Alert webhook and the reading push
// raise alerts, so they fill this in and share the insert and the fan-out below.
type Opening struct {
	ExternalID    string
	DistributorID string
	OutletID      string
	DeviceID      string
	SensorID      string
	SensorName    string
	SensorType    domain.SensorType
	Category      domain.AlertCategory
	TriggerValue  string
	TriggerTime   time.Time
	Message       string
}

// Raise opens an alert and queues the fan-out to the outlet's employees.
func Raise(ctx context.Context, db store.DB, q jobs.Queue, in Opening) (int64, error) {
	var id int64
	if err := db.QueryRow(ctx, `
		INSERT INTO alert (external_alert_id, distributor_id, outlet_id, device_id, sensor_id, sensor_name, sensor_type,
			category, status, trigger_value, trigger_time, message, channels)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'UNACKNOWLEDGED',$9,$10,$11,'{app}')
		RETURNING id`,
		nullIfEmpty(in.ExternalID), in.DistributorID, in.OutletID, in.DeviceID, in.SensorID, in.SensorName,
		in.SensorType, in.Category, in.TriggerValue, in.TriggerTime, in.Message).Scan(&id); err != nil {
		return 0, err
	}
	if err := jobs.Emit(ctx, db, q, jobs.AlertTriggered, jobs.Payload{"alertId": id, "outletId": in.OutletID}); err != nil {
		return 0, err
	}
	return id, nil
}

// OpenOn returns the newest alert on a sensor that nobody has resolved yet.
func OpenOn(ctx context.Context, db store.DB, sensorID string) (int64, bool, error) {
	var id int64
	err := db.QueryRow(ctx, `SELECT id FROM alert WHERE sensor_id = $1 AND status NOT IN ('RESOLVED','VERIFIED')
		ORDER BY trigger_time DESC LIMIT 1`, sensorID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	return id, err == nil, err
}

// Close resolves one alert with the value that ended the condition.
func Close(ctx context.Context, db store.DB, q jobs.Queue, id int64, outletID, clearValue string, at time.Time) error {
	if _, err := db.Exec(ctx, `UPDATE alert SET status='RESOLVED', clear_value=$2, clear_time=$3, resolved_at=$3 WHERE id=$1`,
		id, nullIfEmpty(clearValue), at); err != nil {
		return err
	}
	return jobs.Emit(ctx, db, q, jobs.AlertCleared, jobs.Payload{"alertId": id, "outletId": outletID})
}

func nullIfEmpty(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
