package test

import (
	"context"
	"testing"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
)

// fixture is the small, deterministic world every test runs against. It stays hand written
// rather than loading packages/fixtures, so a test can assert exact counts.
type fixture struct {
	AdminToken      string
	EmployeeToken   string
	TechToken       string
	OtherAdminToken string
	OutletA         string // the employee is registered here
	OutletB         string // and here
	OutletC         string // but not here
	DeviceA         string
	SensorA         string
	DeviceTypeID    string
	TechnicianID    string
	EmployeeID      string
}

// reset wipes and rebuilds the world. Each test that mutates data calls it, so order never
// matters and a failure cannot cascade into the next test.
func reset(t *testing.T) fixture {
	t.Helper()
	ctx := context.Background()

	for _, table := range []string{
		"alert_response", "alert", "reading", "ticket", "contact_person", "employee_outlet", "employee",
		"technician", "sensor", "device", "device_type", "admin_user", "outlet", "integration_config",
		"distributor", "outbox_event", "request_log", "unmatched_event",
	} {
		if _, err := db.Exec(ctx, "DELETE FROM "+table); err != nil {
			t.Fatalf("clear %s: %v", table, err)
		}
	}

	hash, err := auth.HashPassword(adminPass)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 16, 8, 0, 0, 0, time.UTC)
	f := fixture{
		OutletA: "out-a", OutletB: "out-b", OutletC: "out-c",
		DeviceA: "dev-a", SensorA: "sen-a", DeviceTypeID: "dt-ra3s",
		TechnicianID: "tech-1", EmployeeID: "emp-1",
	}

	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}

	for _, d := range []struct{ id, code, name string }{
		{tenant, "DC-TEST", "Test Distribution Center"},
		{otherTenant, "DC-OTHER", "Other Distribution Center"},
	} {
		exec(`INSERT INTO distributor (id, code, name, region, city, address, admin_user_id)
			VALUES ($1,$2,$3,'Jawa Timur','Surabaya','Jl. Test','adm-1')`, d.id, d.code, d.name)
	}
	exec(`INSERT INTO admin_user (id, distributor_id, name, email, password_hash, role, avatar_color)
		VALUES ('adm-1',$1,'Test Admin',$2,$3,'admin','#101112')`, tenant, adminEmail, hash)

	for _, o := range []struct{ id, code, name string }{
		{f.OutletA, "IDM-0001", "Indomaret Alpha"},
		{f.OutletB, "IDM-0002", "Indomaret Bravo"},
		{f.OutletC, "IDM-0003", "Indomaret Charlie"},
	} {
		exec(`INSERT INTO outlet (id, distributor_id, code, name, address, city, province, lat, lng, maps_url,
			open_time, close_time, timezone, phone)
			VALUES ($1,$2,$3,$4,'Jl. Test','Surabaya','Jawa Timur',-7.3,112.7,'','07:00','22:00','Asia/Jakarta','031')`,
			o.id, tenant, o.code, o.name)
	}

	exec(`INSERT INTO device_type (id, model, name, vendor, ports, built_in_sensors, description, price_idr,
		latest_firmware, maintenance_interval_days)
		VALUES ($1,'RA3S','Room Alert 3S','AVTECH','[{"kind":"digital","count":1},{"kind":"switch","count":1}]',
		'{TEMPERATURE}','Compact monitor',8850000,'v2.9.1',180)`, f.DeviceTypeID)

	// Two devices: one at an outlet the employee covers, one at an outlet they do not.
	for _, d := range []struct{ id, outlet, serial, mac string }{
		{f.DeviceA, f.OutletA, "RA3-AAA-RA3S", "00:80:A3:00:00:01"},
		{"dev-c", f.OutletC, "RA3-CCC-RA3S", "00:80:A3:00:00:02"},
	} {
		exec(`INSERT INTO device (id, distributor_id, outlet_id, device_type_id, model, serial, mac, ip, firmware,
			status, last_push_at, installed_at, push_interval_sec, ports, channels, warranty_until, next_maintenance_at,
			uptime_pct, sensor_faults, floor_x, floor_y)
			VALUES ($1,$2,$3,$4,'RA3S',$5,$6,'192.168.1.10','v2.9.1','online',$7,$7,300,
			'[{"index":1,"kind":"digital","label":"Digital 1","sensorId":null}]','{app}',$8,$8,100,0,91,60)`,
			d.id, tenant, d.outlet, f.DeviceTypeID, d.serial, d.mac, now, now.AddDate(1, 0, 0))
	}

	for _, s := range []struct{ id, device, outlet, name string }{
		{f.SensorA, f.DeviceA, f.OutletA, "Sales Area Temp & RH"},
		{"sen-c", "dev-c", f.OutletC, "Sales Area Temp & RH"},
	} {
		exec(`INSERT INTO sensor (id, distributor_id, device_id, outlet_id, name, type, port_kind, port_index, unit,
			thresholds, enabled, floor_x, floor_y)
			VALUES ($1,$2,$3,$4,$5,'TEMPERATURE_HUMIDITY','digital',1,'°C','{"min":18,"max":28}',true,50,52)`,
			s.id, tenant, s.device, s.outlet, s.name)
	}

	exec(`INSERT INTO technician (id, distributor_id, name, phone, specialty, avatar_color, email, registration_token)
		VALUES ($1,$2,'Test Teknisi','0813','Room Alert hardware','#101112',$3,$4)`,
		f.TechnicianID, tenant, techMail, techTok)
	exec(`INSERT INTO employee (id, distributor_id, primary_outlet_id, name, phone, email, role, registration_token,
		registration_status, registered_at, approved_at, avatar_color)
		VALUES ($1,$2,$3,'Test Karyawan','0812',$4,'store_manager',$5,'approved',$6,$6,'#101112')`,
		f.EmployeeID, tenant, f.OutletA, employeeMail, employeeTok, now)
	exec(`INSERT INTO employee_outlet (employee_id, outlet_id) VALUES ($1,$2), ($1,$3)`, f.EmployeeID, f.OutletA, f.OutletB)

	exec(`INSERT INTO contact_person (id, outlet_id, name, phone, email, role, is_primary, channels)
		VALUES ('cp-a',$1,'Kontak Alpha','0821','a@test.id','Kepala Toko',true,'{app}'),
		       ('cp-c',$2,'Kontak Charlie','0822','c@test.id','Kepala Toko',true,'{app}')`, f.OutletA, f.OutletC)

	// One open alert at the employee's outlet, one resolved, one at an outlet they cannot see.
	for _, a := range []struct {
		id      int64
		outlet  string
		device  string
		sensor  string
		status  string
		minutes int
	}{
		{9001, f.OutletA, f.DeviceA, f.SensorA, "UNACKNOWLEDGED", 30},
		{9002, f.OutletA, f.DeviceA, f.SensorA, "RESOLVED", 60},
		{9003, f.OutletC, "dev-c", "sen-c", "UNACKNOWLEDGED", 45},
	} {
		exec(`INSERT INTO alert (id, distributor_id, outlet_id, device_id, sensor_id, sensor_name, sensor_type,
			category, status, trigger_value, trigger_time, message, channels)
			VALUES ($1,$2,$3,$4,$5,'Sales Area Temp & RH','TEMPERATURE_HUMIDITY','COMFORT',$6::alert_status,'30.1 °C',$7,
			'Temperature above 28.00 °C','{app}')`,
			a.id, tenant, a.outlet, a.device, a.sensor, a.status, now.Add(-time.Duration(a.minutes)*time.Minute))
	}
	exec(`INSERT INTO alert_response (alert_id, employee_id, notes, photo_urls, responded_at, response_duration_sec)
		VALUES (9002,$1,'Checked the cooler','{}',$2,600)`, f.EmployeeID, now.Add(-50*time.Minute))
	exec(`SELECT setval(pg_get_serial_sequence('alert','id'), 9100, false)`)
	exec(`SELECT setval('ticket_seq', 2601, false)`)

	exec(`INSERT INTO ticket (id, distributor_id, outlet_id, device_id, type, priority, status, title, description,
		created_at, parts_used, photo_urls)
		VALUES ('MT-2600',$1,$2,$3,'PREVENTIVE','MEDIUM','OPEN','Semi-annual check','',$4,'{}','{}')`,
		tenant, f.OutletA, f.DeviceA, now.Add(-24*time.Hour))

	for i := range 6 {
		exec(`INSERT INTO reading (sensor_id, at, temperature_c, humidity_pct) VALUES ($1,$2,$3,$4)`,
			f.SensorA, now.Add(-time.Duration(i)*time.Hour), 26.0+float64(i)/10, 50.0+float64(i))
	}
	exec(`INSERT INTO reading (sensor_id, at, temperature_c, humidity_pct) VALUES ('sen-c',$1,30.0,60.0)`, now)

	f.AdminToken = token(t, auth.KindAdmin, "adm-1", tenant, nil)
	f.EmployeeToken = token(t, auth.KindEmployee, f.EmployeeID, tenant, []string{f.OutletA, f.OutletB})
	f.TechToken = token(t, auth.KindTechnician, f.TechnicianID, tenant, nil)
	f.OtherAdminToken = token(t, auth.KindAdmin, "adm-2", otherTenant, nil)
	return f
}

func (f fixture) path(suffix string) string { return "/distributors/" + tenant + suffix }
