package devices

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const deviceColumns = `id, outlet_id, device_type_id, model, serial, mac, ip, firmware, status, last_push_at, installed_at,
	push_interval_sec, ports, channels, warranty_until, last_maintenance_at, next_maintenance_at, uptime_pct, sensor_faults, floor_x, floor_y`

const sensorColumns = `id, device_id, outlet_id, name, type, port_kind, port_index, unit, thresholds, enabled, floor_x, floor_y`

type Repo struct {
	db     store.DB
	tenant string
}

func NewRepo(db store.DB, tenant string) Repo { return Repo{db: db, tenant: tenant} }

type ListOpts struct {
	Cursor   string
	Limit    int
	OutletID string
	Status   string
	// Scope narrows the list to the outlets an employee is registered at. Nil means the whole
	// distribution center, which is what admins and technicians get.
	Scope []string
}

func (r Repo) List(ctx context.Context, o ListOpts) (httpx.Page[domain.Device], error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+deviceColumns+` FROM device
		WHERE distributor_id = $1
		  AND ($2 = '' OR outlet_id = $2)
		  AND ($3 = '' OR status::text = $3)
		  AND ($4 = '' OR serial > $4)
		  AND ($5::text[] IS NULL OR outlet_id = ANY($5))
		ORDER BY serial
		LIMIT $6`, r.tenant, o.OutletID, o.Status, httpx.DecodeCursor(o.Cursor), o.Scope, o.Limit+1)
	if err != nil {
		return httpx.Page[domain.Device]{}, err
	}
	defer rows.Close()

	page := httpx.Page[domain.Device]{Items: []domain.Device{}}
	for rows.Next() {
		d, err := scanDevice(rows)
		if err != nil {
			return page, err
		}
		page.Items = append(page.Items, d)
	}
	if err := rows.Err(); err != nil {
		return page, err
	}
	if len(page.Items) > o.Limit {
		page.Items = page.Items[:o.Limit]
		cursor := httpx.EncodeCursor(page.Items[len(page.Items)-1].Serial)
		page.NextCursor = &cursor
	}
	return page, nil
}

func (r Repo) Find(ctx context.Context, id string) (domain.Device, error) {
	d, err := scanDevice(r.db.QueryRow(ctx, `SELECT `+deviceColumns+` FROM device WHERE id = $1 AND distributor_id = $2`, id, r.tenant))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Device{}, httpx.NotFound("Device", id)
	}
	return d, err
}

// SensorOpts filters the tenant-wide sensor list the floor plans and shopfloor view load.
type SensorOpts struct {
	OutletID string
	DeviceID string
	Scope    []string
}

// ListSensors answers every sensor the session may see in one call, which is what the admin
// and mobile apps need to draw floor plans without a request per device.
func (r Repo) ListSensors(ctx context.Context, o SensorOpts) ([]domain.Sensor, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+sensorColumns+` FROM sensor
		WHERE distributor_id = $1
		  AND ($2 = '' OR outlet_id = $2)
		  AND ($3 = '' OR device_id = $3)
		  AND ($4::text[] IS NULL OR outlet_id = ANY($4))
		ORDER BY outlet_id, device_id, port_kind, port_index`, r.tenant, o.OutletID, o.DeviceID, o.Scope)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectSensors(rows)
}

func (r Repo) SensorsOf(ctx context.Context, deviceID string) ([]domain.Sensor, error) {
	rows, err := r.db.Query(ctx, `SELECT `+sensorColumns+` FROM sensor WHERE device_id = $1 AND distributor_id = $2 ORDER BY port_kind, port_index`, deviceID, r.tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectSensors(rows)
}

func collectSensors(rows pgx.Rows) ([]domain.Sensor, error) {
	out := []domain.Sensor{}
	for rows.Next() {
		s, err := scanSensor(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// InsertWithSensors writes the unit and its sensors in one transaction, so a half-registered
// device never shows up on a floor plan.
func (r Repo) InsertWithSensors(ctx context.Context, d domain.Device, sensors []domain.Sensor) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	ports, err := json.Marshal(d.Ports)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO device (id, distributor_id, outlet_id, device_type_id, model, serial, mac, ip, firmware, status, last_push_at,
			installed_at, push_interval_sec, ports, channels, warranty_until, last_maintenance_at, next_maintenance_at,
			uptime_pct, sensor_faults, floor_x, floor_y)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
		d.ID, r.tenant, d.OutletID, d.DeviceTypeID, d.Model, d.Serial, d.MAC, d.IP, d.Firmware, d.Status, d.LastPushAt,
		d.InstalledAt, d.PushIntervalSec, ports, domain.ChannelsText(d.Channels), d.WarrantyUntil, d.LastMaintenanceAt, d.NextMaintenanceAt,
		d.UptimePct, d.SensorFaults, d.Floor.X, d.Floor.Y); err != nil {
		return err
	}
	for _, s := range sensors {
		if err := insertSensor(ctx, tx, r.tenant, s); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Update changes the mutable columns. Serial and MAC stay put: they are printed on the unit.
func (r Repo) Update(ctx context.Context, d domain.Device) (domain.Device, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE device SET outlet_id=$3, ip=$4, firmware=$5, status=$6, push_interval_sec=$7, warranty_until=$8,
			last_maintenance_at=$9, next_maintenance_at=$10, sensor_faults=$11, floor_x=$12, floor_y=$13, channels=$14
		WHERE id = $1 AND distributor_id = $2
		RETURNING `+deviceColumns,
		d.ID, r.tenant, d.OutletID, d.IP, d.Firmware, d.Status, d.PushIntervalSec, d.WarrantyUntil,
		d.LastMaintenanceAt, d.NextMaintenanceAt, d.SensorFaults, d.Floor.X, d.Floor.Y, domain.ChannelsText(d.Channels))
	out, err := scanDevice(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Device{}, httpx.NotFound("Device", d.ID)
	}
	return out, err
}

// MoveSensors follows a device to another outlet so the floor plan stays consistent.
func (r Repo) MoveSensors(ctx context.Context, deviceID, outletID string) error {
	_, err := r.db.Exec(ctx, `UPDATE sensor SET outlet_id = $2 WHERE device_id = $1`, deviceID, outletID)
	return err
}

func (r Repo) DeleteSensor(ctx context.Context, deviceID, sensorID string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM sensor WHERE id = $1 AND device_id = $2 AND distributor_id = $3`,
		sensorID, deviceID, r.tenant)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("Sensor", sensorID)
	}
	return nil
}

func (r Repo) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM device WHERE id = $1 AND distributor_id = $2`, id, r.tenant)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("Device", id)
	}
	return nil
}

func (r Repo) PortTaken(ctx context.Context, deviceID string, kind domain.PortKind, index int, exceptSensorID string) (string, error) {
	var name string
	err := r.db.QueryRow(ctx, `SELECT name FROM sensor WHERE device_id = $1 AND port_kind = $2 AND port_index = $3 AND id <> $4`,
		deviceID, kind, index, exceptSensorID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return name, err
}

func (r Repo) UpsertSensor(ctx context.Context, s domain.Sensor) (domain.Sensor, error) {
	thresholds, err := json.Marshal(s.Thresholds)
	if err != nil {
		return domain.Sensor{}, err
	}
	if s.Thresholds == nil {
		thresholds = nil
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO sensor (id, distributor_id, device_id, outlet_id, name, type, port_kind, port_index, unit, thresholds, enabled, floor_x, floor_y)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (id) DO UPDATE SET name=$5, type=$6, port_kind=$7, port_index=$8, unit=$9, thresholds=$10, enabled=$11, floor_x=$12, floor_y=$13
		RETURNING `+sensorColumns,
		s.ID, r.tenant, s.DeviceID, s.OutletID, s.Name, s.Type, s.PortKind, s.PortIndex, s.Unit, thresholds, s.Enabled, s.Floor.X, s.Floor.Y)
	return scanSensor(row)
}

func insertSensor(ctx context.Context, tx pgx.Tx, tenant string, s domain.Sensor) error {
	thresholds, err := json.Marshal(s.Thresholds)
	if err != nil {
		return err
	}
	if s.Thresholds == nil {
		thresholds = nil
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO sensor (id, distributor_id, device_id, outlet_id, name, type, port_kind, port_index, unit, thresholds, enabled, floor_x, floor_y)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		s.ID, tenant, s.DeviceID, s.OutletID, s.Name, s.Type, s.PortKind, s.PortIndex, s.Unit, thresholds, s.Enabled, s.Floor.X, s.Floor.Y)
	return err
}

// DeviceTypeOf reads the model definition a new unit is built from.
func (r Repo) DeviceType(ctx context.Context, id string) (domain.DeviceType, error) {
	var t domain.DeviceType
	var ports []byte
	err := r.db.QueryRow(ctx, `SELECT id, model, name, vendor, ports, built_in_sensors, description, price_idr, latest_firmware, maintenance_interval_days
		FROM device_type WHERE id = $1`, id).
		Scan(&t.ID, &t.Model, &t.Name, &t.Vendor, &ports, &t.BuiltInSensors, &t.Description, &t.PriceIDR, &t.LatestFirmware, &t.MaintenanceIntervalDays)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DeviceType{}, httpx.NotFound("Device type", id)
	}
	if err != nil {
		return domain.DeviceType{}, err
	}
	return t, json.Unmarshal(ports, &t.Ports)
}

func (r Repo) OutletExists(ctx context.Context, outletID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM outlet WHERE id = $1 AND distributor_id = $2)`, outletID, r.tenant).Scan(&ok)
	return ok, err
}

func (r Repo) CountAtOutlet(ctx context.Context, outletID string) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM device WHERE outlet_id = $1`, outletID).Scan(&n)
	return n, err
}

type scanner interface{ Scan(dest ...any) error }

func scanDevice(s scanner) (domain.Device, error) {
	var d domain.Device
	var (
		ports    []byte
		channels []string
	)
	err := s.Scan(&d.ID, &d.OutletID, &d.DeviceTypeID, &d.Model, &d.Serial, &d.MAC, &d.IP, &d.Firmware, &d.Status,
		&d.LastPushAt, &d.InstalledAt, &d.PushIntervalSec, &ports, &channels, &d.WarrantyUntil, &d.LastMaintenanceAt,
		&d.NextMaintenanceAt, &d.UptimePct, &d.SensorFaults, &d.Floor.X, &d.Floor.Y)
	if err != nil {
		return d, err
	}
	d.Channels = domain.ChannelsFrom(channels)
	return d, json.Unmarshal(ports, &d.Ports)
}

func scanSensor(s scanner) (domain.Sensor, error) {
	var out domain.Sensor
	var thresholds []byte
	if err := s.Scan(&out.ID, &out.DeviceID, &out.OutletID, &out.Name, &out.Type, &out.PortKind, &out.PortIndex,
		&out.Unit, &thresholds, &out.Enabled, &out.Floor.X, &out.Floor.Y); err != nil {
		return out, err
	}
	if len(thresholds) > 0 {
		if err := json.Unmarshal(thresholds, &out.Thresholds); err != nil {
			return out, err
		}
	}
	return out, nil
}
