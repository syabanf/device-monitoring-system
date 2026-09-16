package test

import (
	"net/http"
	"testing"
)

// An employee registered at out-a and out-b must never see out-c, and never another distributor.
func TestEmployeeListsStayInsideTheirOutlets(t *testing.T) {
	f := reset(t)
	employee := as(t, f.EmployeeToken)

	for path, want := range map[string]int{
		"/alerts":          2,
		"/devices":         1,
		"/contact-persons": 1,
		"/employees":       1,
		"/tickets":         1,
	} {
		items := employee.get(f.path(path)).expect(http.StatusOK).items()
		if len(items) != want {
			t.Errorf("%s returned %d rows, want %d", path, len(items), want)
		}
		for _, row := range items {
			if outlet, ok := row.(map[string]any)["outletId"].(string); ok && outlet == f.OutletC {
				t.Errorf("%s leaked a row from the uncovered outlet", path)
			}
		}
	}
}

func TestEmployeeCannotReachAnUncoveredOutlet(t *testing.T) {
	f := reset(t)
	employee := as(t, f.EmployeeToken)

	employee.get(f.path("/alerts?outletId=" + f.OutletC)).expect(http.StatusForbidden)
	employee.get("/alerts/9003").expect(http.StatusForbidden)
	employee.post("/alerts/9003/respond", map[string]any{"notes": "x"}).expect(http.StatusForbidden)
	employee.get(f.path("/readings/latest?outletId=" + f.OutletC)).expect(http.StatusForbidden)
}

func TestTenantIsolation(t *testing.T) {
	f := reset(t)
	stranger := as(t, f.OtherAdminToken)

	// The path names our tenant but the token belongs to the other one.
	stranger.get(f.path("/outlets")).expect(http.StatusForbidden)
	stranger.get(f.path("/devices")).expect(http.StatusForbidden)
	stranger.get("/alerts/9001").expect(http.StatusNotFound)
	stranger.get(f.path("/stats")).expect(http.StatusForbidden)
}

func TestWriteEndpointsRejectEmployees(t *testing.T) {
	f := reset(t)
	employee := as(t, f.EmployeeToken)

	outlet := map[string]any{"code": "IDM-X", "name": "X", "address": "x", "city": "x", "province": "x",
		"lat": 0, "lng": 0, "mapsUrl": "", "openTime": "07:00", "closeTime": "22:00", "timezone": "Asia/Jakarta", "phone": ""}
	employee.post(f.path("/outlets"), outlet).expect(http.StatusForbidden)
	employee.del(f.path("/outlets/" + f.OutletA)).expect(http.StatusForbidden)
	employee.post(f.path("/employees/"+f.EmployeeID+"/token"), map[string]any{}).expect(http.StatusForbidden)
	employee.put(f.path("/integration"), map[string]any{}).expect(http.StatusForbidden)
}

func TestUnauthenticatedAndMalformedTokens(t *testing.T) {
	f := reset(t)

	as(t, "").get(f.path("/outlets")).expect(http.StatusUnauthorized)
	as(t, "not-a-jwt").get(f.path("/outlets")).expect(http.StatusUnauthorized)
	as(t, f.AdminToken).get("/health").expect(http.StatusOK)
}

func TestLogin(t *testing.T) {
	f := reset(t)
	anon := as(t, "")

	admin := anon.post("/auth/admin/login", map[string]any{"email": adminEmail, "password": adminPass}).
		expect(http.StatusOK)
	if got := admin.str("session.kind"); got != "admin" {
		t.Errorf("want an admin session, got %s", got)
	}
	anon.post("/auth/admin/login", map[string]any{"email": adminEmail, "password": "wrong-password"}).
		expect(http.StatusUnauthorized)

	staff := anon.post("/auth/token/login", map[string]any{"email": employeeMail, "token": employeeTok}).
		expect(http.StatusOK)
	if got := len(staff.field("session.outletIds").([]any)); got != 2 {
		t.Errorf("the session should carry 2 outlets, got %d", got)
	}
	anon.post("/auth/token/login", map[string]any{"email": employeeMail, "token": "9999999999"}).
		expect(http.StatusUnauthorized)

	tech := anon.post("/auth/token/login", map[string]any{"email": techMail, "token": techTok}).
		expect(http.StatusOK)
	if got := tech.str("session.kind"); got != "technician" {
		t.Errorf("want a technician session, got %s", got)
	}
	_ = f
}
