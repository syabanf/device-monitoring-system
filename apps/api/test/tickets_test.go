package test

import (
	"net/http"
	"testing"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
)

func TestTicketCreateAssignAndComplete(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	created := admin.post(f.path("/tickets"), map[string]any{
		"outletId": f.OutletA, "deviceId": f.DeviceA, "sensorId": nil, "type": "CORRECTIVE",
		"priority": "HIGH", "title": "Sensor pintu tidak membaca", "description": "Kontak longgar",
		"technicianId": nil, "scheduledAt": nil,
	}).expect(http.StatusCreated)
	id := created.str("id")
	if got := created.str("status"); got != "OPEN" {
		t.Errorf("a ticket with no technician starts OPEN, got %s", got)
	}
	if id == "MT-2600" {
		t.Error("the new ticket reused the seeded id")
	}

	assigned := admin.patch(f.path("/tickets/"+id), map[string]any{
		"technicianId": f.TechnicianID, "status": "SCHEDULED", "scheduledAt": "2026-09-20T02:00:00Z",
	}).expect(http.StatusOK)
	if got := assigned.str("technicianId"); got != f.TechnicianID {
		t.Errorf("assignment did not stick, got %s", got)
	}

	tech := as(t, f.TechToken)
	tech.patch(f.path("/tickets/"+id), map[string]any{"status": "IN_PROGRESS"}).expect(http.StatusOK)
	done := tech.patch(f.path("/tickets/"+id), map[string]any{
		"status": "DONE", "notes": "Kabel diganti", "partsUsed": []string{"Kabel RJ45"},
		"photoUrls": []string{photo(t, f.TechToken)},
	}).expect(http.StatusOK)
	if done.field("completedAt") == nil {
		t.Error("completing a ticket must stamp completedAt")
	}

	// DONE is the end of the road.
	if code := tech.patch(f.path("/tickets/"+id), map[string]any{"status": "OPEN"}).
		expect(http.StatusConflict).code(); code != "INVALID_TRANSITION" {
		t.Errorf("want INVALID_TRANSITION, got %s", code)
	}

	var queued int
	if err := db.QueryRow(t.Context(),
		`SELECT count(*) FROM outbox_event WHERE name = 'ticket.completed' AND payload->>'ticketId' = $1`, id).Scan(&queued); err != nil {
		t.Fatal(err)
	}
	if queued != 1 {
		t.Errorf("want 1 ticket.completed row in the outbox, got %d", queued)
	}
}

func TestTicketGuards(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	// The device has to live at the outlet named in the body.
	admin.post(f.path("/tickets"), map[string]any{
		"outletId": f.OutletB, "deviceId": f.DeviceA, "sensorId": nil, "type": "PREVENTIVE",
		"priority": "LOW", "title": "Cek rutin", "description": "", "technicianId": nil, "scheduledAt": nil,
	}).expect(http.StatusNotFound)

	admin.post(f.path("/tickets"), map[string]any{
		"outletId": f.OutletA, "deviceId": f.DeviceA, "sensorId": nil, "type": "PREVENTIVE",
		"priority": "LOW", "title": "  ", "description": "", "technicianId": nil, "scheduledAt": nil,
	}).expect(http.StatusBadRequest)

	as(t, f.EmployeeToken).patch(f.path("/tickets/MT-2600"), map[string]any{"status": "SCHEDULED"}).
		expect(http.StatusForbidden)

	admin.patch(f.path("/tickets/MT-9999"), map[string]any{"status": "SCHEDULED"}).expect(http.StatusNotFound)
}

func TestTicketAssignedToAnotherTechnicianIsClosed(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	admin.patch(f.path("/tickets/MT-2600"), map[string]any{"technicianId": f.TechnicianID}).expect(http.StatusOK)
	other := as(t, token(t, auth.KindTechnician, "tech-2", tenant, nil))
	other.patch(f.path("/tickets/MT-2600"), map[string]any{"status": "IN_PROGRESS"}).expect(http.StatusForbidden)
}

func TestTicketFilters(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	for query, want := range map[string]int{
		"":                        1,
		"?status=OPEN":            1,
		"?status=DONE":            0,
		"?outletId=" + f.OutletA:  1,
		"?deviceId=" + f.DeviceA:  1,
		"?technicianId=tech-none": 0,
	} {
		if got := len(admin.get(f.path("/tickets" + query)).expect(http.StatusOK).items()); got != want {
			t.Errorf("%q returned %d tickets, want %d", query, got, want)
		}
	}
}
