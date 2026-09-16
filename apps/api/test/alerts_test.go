package test

import (
	"net/http"
	"testing"
)

func TestAlertListFilters(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	if got := len(admin.get(f.path("/alerts")).expect(http.StatusOK).items()); got != 3 {
		t.Errorf("the fixture holds 3 alerts, got %d", got)
	}
	for query, want := range map[string]int{
		"?status=UNACKNOWLEDGED":      2,
		"?status=RESOLVED":            1,
		"?outletId=" + f.OutletA:      2,
		"?outletId=" + f.OutletC:      1,
		"?category=COMFORT":           3,
		"?since=2099-01-01T00:00:00Z": 0,
	} {
		if got := len(admin.get(f.path("/alerts" + query)).expect(http.StatusOK).items()); got != want {
			t.Errorf("%s returned %d alerts, want %d", query, got, want)
		}
	}
}

func TestAlertPaginationWalksWithoutRepeats(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	seen := map[float64]bool{}
	cursor := ""
	for range 5 {
		url := f.path("/alerts?limit=1")
		if cursor != "" {
			url += "&cursor=" + cursor
		}
		page := admin.get(url).expect(http.StatusOK)
		items := page.items()
		if len(items) == 0 {
			break
		}
		id := items[0].(map[string]any)["id"].(float64)
		if seen[id] {
			t.Fatalf("alert %v came back twice", id)
		}
		seen[id] = true
		nextCursor, ok := page.field("nextCursor").(string)
		if !ok || nextCursor == "" {
			break
		}
		cursor = nextCursor
	}
	if len(seen) != 3 {
		t.Errorf("paging saw %d of 3 alerts", len(seen))
	}
}

func TestOnlyTheFirstEmployeeClaimsAnAlert(t *testing.T) {
	f := reset(t)
	employee := as(t, f.EmployeeToken)

	responded := employee.post("/alerts/9001/respond", map[string]any{
		"notes": "Pintu chiller ditutup kembali", "photoUrls": []string{photo(t, f.EmployeeToken)},
	}).expect(http.StatusOK)
	if got := responded.str("response.employeeId"); got != f.EmployeeID {
		t.Errorf("the response names %s, want %s", got, f.EmployeeID)
	}
	if got := responded.str("status"); got != "RESPONDING" {
		t.Errorf("responding should move the alert to RESPONDING, got %s", got)
	}

	if code := employee.post("/alerts/9001/respond", map[string]any{"notes": "again"}).
		expect(http.StatusConflict).code(); code != "ALREADY_RESPONDED" {
		t.Errorf("want ALREADY_RESPONDED, got %s", code)
	}

	employee.post("/alerts/9001/respond", map[string]any{"notes": "  "}).expect(http.StatusBadRequest)
}

func TestAdminsCannotRespondAndEmployeesCannotVerify(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)
	employee := as(t, f.EmployeeToken)

	admin.post("/alerts/9001/respond", map[string]any{"notes": "admin note"}).expect(http.StatusForbidden)

	if code := employee.post("/alerts/9002/status", map[string]any{"status": "VERIFIED"}).
		expect(http.StatusForbidden).code(); code != "FORBIDDEN" {
		t.Errorf("want FORBIDDEN, got %s", code)
	}
	if got := admin.post("/alerts/9002/status", map[string]any{"status": "VERIFIED"}).
		expect(http.StatusOK).str("status"); got != "VERIFIED" {
		t.Errorf("admin verify failed, got %s", got)
	}
}

func TestAlertStatusFollowsTheLifecycle(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	admin.post("/alerts/9001/status", map[string]any{"status": "ACKNOWLEDGED"}).expect(http.StatusOK)
	// Going back is not part of the lifecycle.
	if code := admin.post("/alerts/9001/status", map[string]any{"status": "UNACKNOWLEDGED"}).
		expect(http.StatusConflict).code(); code != "INVALID_TRANSITION" {
		t.Errorf("want INVALID_TRANSITION, got %s", code)
	}
	// Repeating the current status is a no-op rather than an error.
	admin.post("/alerts/9001/status", map[string]any{"status": "ACKNOWLEDGED"}).expect(http.StatusOK)

	resolved := admin.post("/alerts/9001/status", map[string]any{"status": "RESOLVED", "clearValue": "4.0 C"}).
		expect(http.StatusOK)
	if got := resolved.str("clearValue"); got != "4.0 C" {
		t.Errorf("clear value did not persist, got %q", got)
	}
	admin.post("/alerts/9001/status", map[string]any{"status": "SOMETHING"}).expect(http.StatusBadRequest)
}

func TestResolvingAnAlertQueuesAJob(t *testing.T) {
	f := reset(t)
	as(t, f.AdminToken).post("/alerts/9001/status", map[string]any{"status": "RESOLVED"}).expect(http.StatusOK)

	var events int
	if err := db.QueryRow(t.Context(),
		`SELECT count(*) FROM outbox_event WHERE name = 'alert.cleared' AND payload->>'alertId' = '9001'`).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if events != 1 {
		t.Errorf("want 1 alert.cleared row in the outbox, got %d", events)
	}
}
