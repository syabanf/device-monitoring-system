package test

import (
	"net/http"
	"testing"
)

func TestOutletCRUD(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	body := map[string]any{
		"code": "IDM-9001", "name": "Indomaret Delta", "address": "Jl. Baru", "city": "Surabaya",
		"province": "Jawa Timur", "lat": -7.31, "lng": 112.71, "mapsUrl": "", "openTime": "07:00",
		"closeTime": "22:00", "timezone": "Asia/Jakarta", "phone": "031",
	}
	created := admin.post(f.path("/outlets"), body).expect(http.StatusCreated)
	id := created.str("id")
	if got := created.str("mapsUrl"); got == "" {
		t.Error("an empty maps link should be derived from the coordinates")
	}

	admin.get(f.path("/outlets/" + id)).expect(http.StatusOK)

	body["name"] = "Indomaret Delta Renamed"
	if got := admin.put(f.path("/outlets/"+id), body).expect(http.StatusOK).str("name"); got != "Indomaret Delta Renamed" {
		t.Errorf("rename did not stick, got %q", got)
	}

	if code := admin.post(f.path("/outlets"), body).expect(http.StatusConflict).code(); code != "OUTLET_CODE_TAKEN" {
		t.Errorf("want OUTLET_CODE_TAKEN, got %s", code)
	}

	bad := map[string]any{"code": "IDM-9002", "name": "Bad Clock", "address": "x", "city": "Surabaya",
		"province": "Jawa Timur", "lat": 0, "lng": 0, "mapsUrl": "", "openTime": "7am", "closeTime": "22:00",
		"timezone": "Asia/Jakarta", "phone": ""}
	admin.post(f.path("/outlets"), bad).expect(http.StatusBadRequest)

	admin.del(f.path("/outlets/" + id)).expect(http.StatusNoContent)
	admin.get(f.path("/outlets/" + id)).expect(http.StatusNotFound)
}

func TestDeletingAnOutletCascades(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	admin.del(f.path("/outlets/" + f.OutletA)).expect(http.StatusNoContent)

	for _, path := range []string{"/devices", "/contact-persons", "/tickets"} {
		items := admin.get(f.path(path + "?outletId=" + f.OutletA)).expect(http.StatusOK).items()
		if len(items) != 0 {
			t.Errorf("%s still holds %d row(s) after the outlet went", path, len(items))
		}
	}
	if items := admin.get(f.path("/alerts?outletId=" + f.OutletA)).expect(http.StatusOK).items(); len(items) != 0 {
		t.Errorf("alerts survived the cascade: %d", len(items))
	}
}

func TestDeviceTypeCRUD(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	body := map[string]any{
		"model": "RA32S", "name": "Room Alert 32S", "vendor": "AVTECH",
		"ports":          []map[string]any{{"kind": "digital", "count": 8}},
		"builtInSensors": []string{"TEMPERATURE"}, "description": "Bigger unit",
		"priceIdr": 40000000, "latestFirmware": "v1.0.0", "maintenanceIntervalDays": 180,
	}
	id := admin.post("/device-types", body).expect(http.StatusCreated).str("id")

	body["name"] = "Room Alert 32S rev B"
	admin.put("/device-types/"+id, body).expect(http.StatusOK)

	// The seeded model is installed, so it must refuse to disappear.
	if code := admin.del("/device-types/" + f.DeviceTypeID).expect(http.StatusConflict).code(); code != "DEVICE_TYPE_IN_USE" {
		t.Errorf("want DEVICE_TYPE_IN_USE, got %s", code)
	}
	admin.del("/device-types/" + id).expect(http.StatusNoContent)
}

func TestDeviceCreateLaysOutPortsAndSensors(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	created := admin.post(f.path("/devices"), map[string]any{
		"outletId": f.OutletB, "deviceTypeId": f.DeviceTypeID,
		"sensorTypes": []string{"TEMPERATURE_HUMIDITY", "DOOR"},
	}).expect(http.StatusCreated)

	var payload struct {
		Device struct {
			ID    string `json:"id"`
			Ports []struct {
				Kind     string  `json:"kind"`
				Index    int     `json:"index"`
				SensorID *string `json:"sensorId"`
			} `json:"ports"`
		} `json:"device"`
		Sensors []struct {
			Unit      string `json:"unit"`
			PortKind  string `json:"portKind"`
			PortIndex int    `json:"portIndex"`
		} `json:"sensors"`
	}
	created.into(&payload)

	if len(payload.Sensors) != 2 {
		t.Fatalf("want 2 sensors, got %d", len(payload.Sensors))
	}
	filled := 0
	for _, p := range payload.Device.Ports {
		if p.SensorID != nil {
			filled++
		}
	}
	if filled != 2 {
		t.Errorf("the port map should point at both sensors, %d filled", filled)
	}

	// A 3S has one digital and one switch port, so a full loadout cannot fit.
	if code := admin.post(f.path("/devices"), map[string]any{
		"outletId": f.OutletB, "deviceTypeId": f.DeviceTypeID,
		"sensorTypes": []string{"TEMPERATURE_HUMIDITY", "DOOR", "MOTION", "POWER", "PANIC_BUTTON"},
	}).expect(http.StatusBadRequest).code(); code != "PORT_CAPACITY_EXCEEDED" {
		t.Errorf("want PORT_CAPACITY_EXCEEDED, got %s", code)
	}
}

func TestDeviceUpdateMovesSensorsWithIt(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	update := map[string]any{
		"outletId": f.OutletB, "ip": "10.1.2.3", "firmware": "v7.7.7", "status": "offline",
		"pushIntervalSec": 900, "warrantyUntil": "2031-02-03T00:00:00Z", "lastMaintenanceAt": nil,
		"nextMaintenanceAt": "2027-03-04T00:00:00Z", "sensorFaults": 3,
		"floor": map[string]any{"x": 21, "y": 43}, "channels": []string{"app", "telegram"},
	}
	moved := admin.put(f.path("/devices/"+f.DeviceA), update).expect(http.StatusOK)
	if got := moved.str("device.outletId"); got != f.OutletB {
		t.Fatalf("device should sit at %s, got %s", f.OutletB, got)
	}
	if got := moved.num("device.floor.x"); got != 21 {
		t.Errorf("floor position did not persist, got %v", got)
	}
	if got := moved.str("device.status"); got != "offline" {
		t.Errorf("status did not persist, got %s", got)
	}
	for _, sensor := range moved.field("sensors").([]any) {
		if got := sensor.(map[string]any)["outletId"]; got != f.OutletB {
			t.Errorf("a sensor stayed behind at %v", got)
		}
	}

	admin.put(f.path("/devices/"+f.DeviceA), map[string]any{
		"outletId": f.OutletB, "ip": "1", "firmware": "1", "status": "broken", "pushIntervalSec": 900,
		"warrantyUntil": "2031-02-03T00:00:00Z", "lastMaintenanceAt": nil, "nextMaintenanceAt": "2027-03-04T00:00:00Z",
		"sensorFaults": 0, "floor": map[string]any{"x": 1, "y": 1}, "channels": []string{"app"},
	}).expect(http.StatusBadRequest)
}

func TestSensorDeleteFreesThePort(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	sensor := map[string]any{
		"name": "Replacement", "type": "DOOR", "portKind": "digital", "portIndex": 1,
		"unit": "state", "enabled": true, "floor": map[string]any{"x": 10, "y": 10},
	}
	// The port is taken while the seeded sensor holds it.
	if code := admin.put(f.path("/devices/"+f.DeviceA+"/sensors/sen-new"), sensor).expect(http.StatusConflict).code(); code != "PORT_ALREADY_USED" {
		t.Errorf("want PORT_ALREADY_USED, got %s", code)
	}

	admin.del(f.path("/devices/" + f.DeviceA + "/sensors/" + f.SensorA)).expect(http.StatusNoContent)
	admin.del(f.path("/devices/" + f.DeviceA + "/sensors/" + f.SensorA)).expect(http.StatusNotFound)
	admin.put(f.path("/devices/"+f.DeviceA+"/sensors/sen-new"), sensor).expect(http.StatusOK)
}

func TestEmployeeLifecycle(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	body := map[string]any{
		"name": "Karyawan Baru", "phone": "0812345", "email": "baru@test.id", "role": "cashier",
		"outletIds": []string{f.OutletA}, "primaryOutletId": f.OutletA, "avatarColor": "#101112",
	}
	created := admin.post(f.path("/employees"), body).expect(http.StatusCreated)
	id := created.str("id")
	if got := created.str("registrationStatus"); got != "pending" {
		t.Errorf("a new employee starts pending, got %s", got)
	}

	admin.post(f.path("/employees/"+id+"/approve"), map[string]any{}).expect(http.StatusOK)
	first := admin.post(f.path("/employees/"+id+"/token"), map[string]any{}).expect(http.StatusOK).str("registrationToken")
	second := admin.post(f.path("/employees/"+id+"/token"), map[string]any{}).expect(http.StatusOK).str("registrationToken")
	if first == second {
		t.Error("issuing a token again must replace the old one")
	}

	revoked := admin.post(f.path("/employees/"+id+"/revoke"), map[string]any{}).expect(http.StatusOK)
	if revoked.field("registrationToken") != nil {
		t.Error("revoke should clear the token")
	}
	if got := revoked.str("registrationStatus"); got != "pending" {
		t.Errorf("revoke sends the account back to pending, got %s", got)
	}

	body["outletIds"] = []string{"out-nope"}
	body["primaryOutletId"] = "out-nope"
	body["email"] = "another@test.id"
	if code := admin.post(f.path("/employees"), body).expect(http.StatusBadRequest).code(); code != "UNKNOWN_OUTLET" {
		t.Errorf("want UNKNOWN_OUTLET, got %s", code)
	}

	admin.del(f.path("/employees/" + id)).expect(http.StatusNoContent)
}

func TestContactPersonKeepsOnePrimary(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	second := admin.post(f.path("/contact-persons"), map[string]any{
		"outletId": f.OutletA, "name": "Kontak Kedua", "phone": "0899", "email": nil,
		"role": "Wakil", "isPrimary": true, "channels": []string{"app", "telegram"},
	}).expect(http.StatusCreated).str("id")

	for _, c := range admin.get(f.path("/contact-persons?outletId=" + f.OutletA)).expect(http.StatusOK).items() {
		row := c.(map[string]any)
		if row["id"] != second && row["isPrimary"] == true {
			t.Errorf("%v should have stepped down as primary", row["id"])
		}
	}
	admin.del(f.path("/contact-persons/" + second)).expect(http.StatusNoContent)
}

func TestTechnicianTokenRotation(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	before := admin.get(f.path("/technicians/" + f.TechnicianID)).expect(http.StatusOK).str("registrationToken")
	after := admin.post(f.path("/technicians/"+f.TechnicianID+"/token"), map[string]any{}).expect(http.StatusOK).str("registrationToken")
	if before == after {
		t.Error("rotating must replace the token")
	}
}

func TestDistributorReadAndUpdate(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	if got := admin.get(f.path("")).expect(http.StatusOK).num("outlets"); got != 3 {
		t.Errorf("the fixture holds 3 outlets, got %v", got)
	}
	renamed := admin.put(f.path(""), map[string]any{
		"code": "DC-TEST", "name": "Renamed Center", "region": "Jawa Timur", "city": "Surabaya", "address": "Jl. Test",
	}).expect(http.StatusOK)
	if got := renamed.str("name"); got != "Renamed Center" {
		t.Errorf("rename did not stick, got %s", got)
	}
}
