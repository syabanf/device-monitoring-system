// Command seed loads the generated fixtures the frontend ships, so the mock adapter and the
// real API show identical demo data.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

func main() {
	dataDir := flag.String("data", "../../packages/fixtures/data", "directory holding the generated fixture JSON")
	password := flag.String("password", "admin123", "password given to every seeded admin")
	maxReadings := flag.Int("readings", 200, "how many recent readings to load per sensor")
	flag.Parse()

	if err := run(*dataDir, *password, *maxReadings); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(dataDir, password string, maxReadings int) error {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	ctx := context.Background()
	db, err := store.Open(ctx, url)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := store.Migrate(ctx, db); err != nil {
		return err
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	var (
		distributors []distributor
		outlets      []outlet
		deviceTypes  []deviceType
		devices      []device
		sensors      []sensor
		employees    []employee
		technicians  []technician
		contacts     []contactPerson
		admins       []adminUser
		alerts       []alert
		tickets      []ticket
		readings     []reading
	)
	for _, load := range []struct {
		file string
		dst  any
	}{
		{"distributors", &distributors}, {"outlets", &outlets}, {"device-types", &deviceTypes}, {"devices", &devices},
		{"sensors", &sensors}, {"employees", &employees}, {"technicians", &technicians}, {"contact-persons", &contacts},
		{"admin-users", &admins}, {"alerts", &alerts}, {"maintenance-tickets", &tickets}, {"readings", &readings},
	} {
		if err := readJSON(filepath.Join(dataDir, load.file+".json"), load.dst); err != nil {
			return err
		}
	}

	tenantOf := map[string]string{}
	for _, o := range outlets {
		tenantOf[o.ID] = o.DistributorID
	}

	fmt.Println("clearing existing rows")
	for _, table := range []string{"alert_response", "alert", "reading", "ticket", "contact_person", "employee_outlet",
		"employee", "technician", "sensor", "device", "device_type", "admin_user", "outlet", "distributor",
		"outbox_event", "request_log", "unmatched_event"} {
		if _, err := db.Exec(ctx, "DELETE FROM "+table); err != nil {
			return fmt.Errorf("clear %s: %w", table, err)
		}
	}

	for _, d := range distributors {
		if _, err := db.Exec(ctx, `INSERT INTO distributor (id, code, name, region, city, address, admin_user_id)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`, d.ID, d.Code, d.Name, d.Region, d.City, d.Address, d.AdminUserID); err != nil {
			return err
		}
	}
	for _, o := range outlets {
		if _, err := db.Exec(ctx, `INSERT INTO outlet (id, distributor_id, code, name, address, city, province, lat, lng,
			maps_url, open_time, close_time, timezone, phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
			o.ID, o.DistributorID, o.Code, o.Name, o.Address, o.City, o.Province, o.Lat, o.Lng, o.MapsURL,
			o.OpenTime, o.CloseTime, o.Timezone, o.Phone); err != nil {
			return err
		}
	}
	for _, a := range admins {
		if _, err := db.Exec(ctx, `INSERT INTO admin_user (id, distributor_id, name, email, password_hash, role, avatar_color)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`, a.ID, a.DistributorID, a.Name, a.Email, hash, a.Role, a.AvatarColor); err != nil {
			return err
		}
	}
	for _, t := range deviceTypes {
		ports, _ := json.Marshal(t.Ports)
		if _, err := db.Exec(ctx, `INSERT INTO device_type (id, model, name, vendor, ports, built_in_sensors, description,
			price_idr, latest_firmware, maintenance_interval_days) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			t.ID, t.Model, t.Name, t.Vendor, ports, t.BuiltInSensors, t.Description, t.PriceIDR, t.LatestFirmware,
			t.MaintenanceIntervalDays); err != nil {
			return err
		}
	}
	for _, d := range devices {
		ports, _ := json.Marshal(d.Ports)
		if _, err := db.Exec(ctx, `INSERT INTO device (id, distributor_id, outlet_id, device_type_id, model, serial, mac, ip,
			firmware, status, last_push_at, installed_at, push_interval_sec, ports, channels, warranty_until,
			last_maintenance_at, next_maintenance_at, uptime_pct, sensor_faults, floor_x, floor_y)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
			d.ID, tenantOf[d.OutletID], d.OutletID, d.DeviceTypeID, d.Model, d.Serial, d.MAC, d.IP, d.Firmware, d.Status,
			d.LastPushAt, d.InstalledAt, d.PushIntervalSec, ports, d.Channels, d.WarrantyUntil, d.LastMaintenanceAt,
			d.NextMaintenanceAt, d.UptimePct, d.SensorFaults, d.Floor.X, d.Floor.Y); err != nil {
			return err
		}
	}
	for _, s := range sensors {
		var thresholds any
		if s.Thresholds != nil {
			thresholds, _ = json.Marshal(s.Thresholds)
		}
		if _, err := db.Exec(ctx, `INSERT INTO sensor (id, distributor_id, device_id, outlet_id, name, type, port_kind,
			port_index, unit, thresholds, enabled, floor_x, floor_y) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
			s.ID, tenantOf[s.OutletID], s.DeviceID, s.OutletID, s.Name, s.Type, s.PortKind, s.PortIndex, s.Unit,
			thresholds, s.Enabled, s.Floor.X, s.Floor.Y); err != nil {
			return err
		}
	}
	for _, t := range technicians {
		if _, err := db.Exec(ctx, `INSERT INTO technician (id, distributor_id, name, phone, specialty, avatar_color, email,
			registration_token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			t.ID, t.DistributorID, t.Name, t.Phone, t.Specialty, t.AvatarColor, t.Email, t.RegistrationToken); err != nil {
			return err
		}
	}
	for _, e := range employees {
		if _, err := db.Exec(ctx, `INSERT INTO employee (id, distributor_id, primary_outlet_id, name, phone, email, role,
			registration_token, registration_status, registered_at, approved_at, avatar_color)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			e.ID, e.DistributorID, e.PrimaryOutletID, e.Name, e.Phone, e.Email, e.Role, e.RegistrationToken,
			e.RegistrationStatus, e.RegisteredAt, e.ApprovedAt, e.AvatarColor); err != nil {
			return err
		}
		for _, outletID := range e.OutletIDs {
			if _, err := db.Exec(ctx, `INSERT INTO employee_outlet (employee_id, outlet_id) VALUES ($1,$2)`, e.ID, outletID); err != nil {
				return err
			}
		}
	}
	for _, c := range contacts {
		if _, err := db.Exec(ctx, `INSERT INTO contact_person (id, outlet_id, name, phone, email, role, is_primary, channels)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, c.ID, c.OutletID, c.Name, c.Phone, c.Email, c.Role, c.IsPrimary, c.Channels); err != nil {
			return err
		}
	}

	maxAlertID := int64(0)
	for _, a := range alerts {
		a.Status = alertStatus(a.Status)
		if a.ID > maxAlertID {
			maxAlertID = a.ID
		}
		if _, err := db.Exec(ctx, `INSERT INTO alert (id, distributor_id, outlet_id, device_id, sensor_id, sensor_name,
			sensor_type, category, status, trigger_value, trigger_time, clear_value, clear_time, message, channels,
			assignee_employee_id, acknowledged_at, responding_at, resolved_at, verified_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
			a.ID, a.DistributorID, a.OutletID, a.DeviceID, a.SensorID, a.SensorName, a.SensorType, a.Category, a.Status,
			a.TriggerValue, a.TriggerTime, a.ClearValue, a.ClearTime, a.Message, a.Channels, a.AssigneeEmployeeID,
			a.AcknowledgedAt, a.RespondingAt, a.ResolvedAt, a.VerifiedAt); err != nil {
			return err
		}
		if a.Response != nil {
			if _, err := db.Exec(ctx, `INSERT INTO alert_response (alert_id, employee_id, notes, photo_urls, responded_at,
				response_duration_sec) VALUES ($1,$2,$3,$4,$5,$6)`,
				a.ID, a.Response.EmployeeID, a.Response.Notes, a.Response.PhotoURLs, a.Response.RespondedAt,
				a.Response.ResponseDurationSec); err != nil {
				return err
			}
		}
	}
	// Alert ids come from the Room Alert cloud, so move the sequence past them.
	if _, err := db.Exec(ctx, `SELECT setval(pg_get_serial_sequence('alert', 'id'), $1, false)`, maxAlertID+1); err != nil {
		return err
	}

	for _, t := range tickets {
		if _, err := db.Exec(ctx, `INSERT INTO ticket (id, distributor_id, outlet_id, device_id, sensor_id, type, priority,
			status, title, description, technician_id, created_at, scheduled_at, completed_at, parts_used, notes, photo_urls)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
			t.ID, t.DistributorID, t.OutletID, t.DeviceID, t.SensorID, t.Type, t.Priority, t.Status, t.Title, t.Description,
			t.TechnicianID, t.CreatedAt, t.ScheduledAt, t.CompletedAt, t.PartsUsed, t.Notes, t.PhotoURLs); err != nil {
			return err
		}
	}

	if _, err := db.Exec(ctx, `SELECT setval('ticket_seq', (SELECT COALESCE(max(split_part(id,'-',2)::int), 2600) + 1 FROM ticket), false)`); err != nil {
		return err
	}

	// Keep a window per sensor rather than the global tail, so every outlet has a trend to draw.
	bySensor := map[string][]reading{}
	for _, r := range readings {
		bySensor[r.SensorID] = append(bySensor[r.SensorID], r)
	}
	recent := make([]reading, 0, len(bySensor)*maxReadings)
	for _, series := range bySensor {
		if len(series) > maxReadings {
			series = series[len(series)-maxReadings:]
		}
		recent = append(recent, series...)
	}

	for _, r := range recent {
		if _, err := db.Exec(ctx, `INSERT INTO reading (sensor_id, at, temperature_c, humidity_pct)
			VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, r.SensorID, r.At, r.TemperatureC, r.HumidityPct); err != nil {
			return err
		}
	}

	fmt.Printf("seeded %d outlets, %d devices, %d sensors, %d alerts, %d tickets, %d readings\n",
		len(outlets), len(devices), len(sensors), len(alerts), len(tickets), len(recent))
	fmt.Printf("admin password for every seeded admin: %s\n", password)
	return nil
}

// The committed fixtures still carry the first alert vocabulary. packages/fixtures/src/store.ts
// remaps it the same way when the frontend loads them, so both sides show identical data.
func alertStatus(v string) string {
	switch v {
	case "TRIGGERED":
		return "UNACKNOWLEDGED"
	case "RESPONDED":
		return "RESOLVED"
	case "CLEARED":
		return "VERIFIED"
	default:
		return v
	}
}

func readJSON(path string, dst any) error {
	body, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	if err := json.Unmarshal(body, dst); err != nil {
		return fmt.Errorf("parse %s: %w", path, err)
	}
	return nil
}

type distributor struct {
	ID, Code, Name, Region, City, Address string
	AdminUserID                           string `json:"adminUserId"`
}

type outlet struct {
	ID, DistributorID, Code, Name, Address, City, Province string
	Lat, Lng                                               float64
	MapsURL                                                string `json:"mapsUrl"`
	OpenTime, CloseTime, Timezone, Phone                   string
}

type deviceType struct {
	ID, Model, Name, Vendor string
	Ports                   []map[string]any
	BuiltInSensors          []string `json:"builtInSensors"`
	Description             string
	PriceIDR                int64 `json:"priceIdr"`
	LatestFirmware          string
	MaintenanceIntervalDays int `json:"maintenanceIntervalDays"`
}

type floor struct{ X, Y float64 }

type device struct {
	ID, OutletID, DeviceTypeID, Model, Serial, MAC, IP, Firmware, Status string
	LastPushAt, InstalledAt                                              time.Time
	PushIntervalSec                                                      int `json:"pushIntervalSec"`
	Ports                                                                []map[string]any
	Channels                                                             []string
	WarrantyUntil                                                        time.Time  `json:"warrantyUntil"`
	LastMaintenanceAt                                                    *time.Time `json:"lastMaintenanceAt"`
	NextMaintenanceAt                                                    time.Time  `json:"nextMaintenanceAt"`
	UptimePct                                                            float64    `json:"uptimePct"`
	SensorFaults                                                         int        `json:"sensorFaults"`
	Floor                                                                floor
}

type sensor struct {
	ID, DeviceID, OutletID, Name, Type, PortKind string
	PortIndex                                    int `json:"portIndex"`
	Unit                                         string
	Thresholds                                   map[string]float64
	Enabled                                      bool
	Floor                                        floor
}

type employee struct {
	ID, DistributorID        string
	OutletIDs                []string `json:"outletIds"`
	PrimaryOutletID          string   `json:"primaryOutletId"`
	Name, Phone, Email, Role string
	RegistrationToken        *string    `json:"registrationToken"`
	RegistrationStatus       string     `json:"registrationStatus"`
	RegisteredAt             *time.Time `json:"registeredAt"`
	ApprovedAt               *time.Time `json:"approvedAt"`
	AvatarColor              string     `json:"avatarColor"`
}

type technician struct {
	ID, DistributorID, Name, Phone, Specialty string
	AvatarColor                               string `json:"avatarColor"`
	Email                                     string
	RegistrationToken                         string `json:"registrationToken"`
}

type contactPerson struct {
	ID, OutletID, Name, Phone string
	Email                     *string
	Role                      string
	IsPrimary                 bool `json:"isPrimary"`
	Channels                  []string
}

type adminUser struct {
	ID, DistributorID, Name, Email, Role string
	AvatarColor                          string `json:"avatarColor"`
}

type alertResponse struct {
	EmployeeID          string `json:"employeeId"`
	Notes               string
	PhotoURLs           []string  `json:"photoUrls"`
	RespondedAt         time.Time `json:"respondedAt"`
	ResponseDurationSec int       `json:"responseDurationSec"`
}

type alert struct {
	ID                                                      int64
	DistributorID, OutletID, DeviceID, SensorID, SensorName string
	SensorType, Category, Status, TriggerValue              string
	TriggerTime                                             time.Time  `json:"triggerTime"`
	ClearValue                                              *string    `json:"clearValue"`
	ClearTime                                               *time.Time `json:"clearTime"`
	Message                                                 string
	Response                                                *alertResponse
	Channels                                                []string
	AssigneeEmployeeID                                      *string    `json:"assigneeEmployeeId"`
	AcknowledgedAt                                          *time.Time `json:"acknowledgedAt"`
	RespondingAt                                            *time.Time `json:"respondingAt"`
	ResolvedAt                                              *time.Time `json:"resolvedAt"`
	VerifiedAt                                              *time.Time `json:"verifiedAt"`
}

type ticket struct {
	ID, DistributorID, OutletID, DeviceID      string
	SensorID                                   *string `json:"sensorId"`
	Type, Priority, Status, Title, Description string
	TechnicianID                               *string    `json:"technicianId"`
	CreatedAt                                  time.Time  `json:"createdAt"`
	ScheduledAt                                *time.Time `json:"scheduledAt"`
	CompletedAt                                *time.Time `json:"completedAt"`
	PartsUsed                                  []string   `json:"partsUsed"`
	Notes                                      *string
	PhotoURLs                                  []string `json:"photoUrls"`
}

// reading arrives as the compact tuple [sensorId, iso, temperatureC, humidityPct].
type reading struct {
	SensorID     string
	At           time.Time
	TemperatureC float64
	HumidityPct  float64
}

func (r *reading) UnmarshalJSON(raw []byte) error {
	var tuple []json.RawMessage
	if err := json.Unmarshal(raw, &tuple); err != nil || len(tuple) != 4 {
		return fmt.Errorf("reading must be a 4 element tuple")
	}
	var at string
	if err := json.Unmarshal(tuple[0], &r.SensorID); err != nil {
		return err
	}
	if err := json.Unmarshal(tuple[1], &at); err != nil {
		return err
	}
	parsed, err := time.Parse(time.RFC3339, at)
	if err != nil {
		return err
	}
	r.At = parsed
	if err := json.Unmarshal(tuple[2], &r.TemperatureC); err != nil {
		return err
	}
	return json.Unmarshal(tuple[3], &r.HumidityPct)
}
