package test

import (
	"net/http"
	"testing"
)

func TestReadingSeriesAndBuckets(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	raw := admin.get(f.path("/readings?sensorId=" + f.SensorA + "&from=2026-09-16T00:00:00Z&to=2026-09-17T00:00:00Z")).
		expect(http.StatusOK).items()
	if len(raw) != 6 {
		t.Fatalf("want the 6 seeded samples, got %d", len(raw))
	}

	bucketed := admin.get(f.path("/readings?sensorId=" + f.SensorA + "&from=2026-09-16T00:00:00Z&to=2026-09-17T00:00:00Z&bucket=day")).
		expect(http.StatusOK).items()
	if len(bucketed) != 1 {
		t.Fatalf("a day bucket should collapse the samples into 1 row, got %d", len(bucketed))
	}
	if got := bucketed[0].(map[string]any)["samples"]; got != float64(6) {
		t.Errorf("the bucket counts %v samples, want 6", got)
	}

	// An empty window returns an empty list rather than an error.
	if got := admin.get(f.path("/readings?from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z")).
		expect(http.StatusOK).items(); len(got) != 0 {
		t.Errorf("want no rows outside the window, got %d", len(got))
	}
}

func TestLatestReadingPerSensor(t *testing.T) {
	f := reset(t)

	all := as(t, f.AdminToken).get(f.path("/readings/latest")).expect(http.StatusOK).items()
	if len(all) != 2 {
		t.Fatalf("want 1 row per sensor, got %d", len(all))
	}
	// The employee covers out-a and out-b, so sen-c must not appear.
	mine := as(t, f.EmployeeToken).get(f.path("/readings/latest")).expect(http.StatusOK).items()
	if len(mine) != 1 {
		t.Errorf("the employee should see 1 sensor, got %d", len(mine))
	}
}

func TestStatsSummary(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	summary := admin.get(f.path("/stats?period=30d")).expect(http.StatusOK)
	if got := summary.num("total"); got != 3 {
		t.Errorf("want 3 alerts in the period, got %v", got)
	}
	if got := summary.num("open"); got != 2 {
		t.Errorf("want 2 open alerts, got %v", got)
	}
	if got := summary.num("solved"); got != 1 {
		t.Errorf("want 1 solved alert, got %v", got)
	}
	if got := summary.num("devices.total"); got != 2 {
		t.Errorf("want 2 devices, got %v", got)
	}
	if got := summary.num("tickets.open"); got != 1 {
		t.Errorf("want 1 open ticket, got %v", got)
	}
	if got := summary.num("avgResponseSec"); got != 600 {
		t.Errorf("the one response took 600s, got %v", got)
	}
	for _, key := range []string{"perDay", "byOutlet", "alertsByStatus"} {
		if summary.field(key) == nil {
			t.Errorf("%s is missing from the payload", key)
		}
	}

	// An employee sees only their own outlets in the same aggregate.
	scoped := as(t, f.EmployeeToken).get(f.path("/stats?period=30d")).expect(http.StatusOK)
	if got := scoped.num("total"); got != 2 {
		t.Errorf("the employee should count 2 alerts, got %v", got)
	}
	if got := scoped.num("devices.total"); got != 1 {
		t.Errorf("the employee should count 1 device, got %v", got)
	}
}

func TestStatsPeriodNarrowsTheWindow(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	// Every seeded alert is under an hour old, so today and 30 days agree.
	day := admin.get(f.path("/stats?period=today")).expect(http.StatusOK).num("total")
	month := admin.get(f.path("/stats?period=30d")).expect(http.StatusOK).num("total")
	if day != month {
		t.Errorf("today counted %v and 30d counted %v", day, month)
	}
}

func TestIntegrationConfigHidesTheTelegramToken(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	fresh := admin.get(f.path("/integration")).expect(http.StatusOK)
	if fresh.field("telegramTokenSet") != false {
		t.Error("a tenant with no saved config reports a token")
	}

	body := map[string]any{
		"apiBaseUrl": "http://localhost:3000", "webhookPath": "/webhooks/roomalert",
		"roomAlert": map[string]any{"accountEmail": "ops@test.id", "pushIntervalSec": 300, "enabled": true},
		"imap":      map[string]any{"host": "imap.test.id", "port": 993, "user": "ops@test.id", "folder": "INBOX", "pollSec": 60, "enabled": true},
		"telegram":  map[string]any{"botToken": "123:SECRET", "chatId": "-100123", "enabled": true},
		"push":      map[string]any{"provider": "fcm", "enabled": true},
	}
	saved := admin.put(f.path("/integration"), body).expect(http.StatusOK)
	if got := saved.str("telegram.botToken"); got != "" {
		t.Errorf("the token travelled back to the browser: %q", got)
	}
	if saved.field("telegramTokenSet") != true {
		t.Error("the page should learn that a token is stored")
	}

	// Saving the form again with the blank token keeps the stored one.
	body["telegram"].(map[string]any)["botToken"] = ""
	body["telegram"].(map[string]any)["chatId"] = "-100999"
	again := admin.put(f.path("/integration"), body).expect(http.StatusOK)
	if again.field("telegramTokenSet") != true {
		t.Error("an empty token in the form wiped the stored secret")
	}
	if got := again.str("telegram.chatId"); got != "-100999" {
		t.Errorf("the chat id did not update, got %s", got)
	}

	var stored string
	if err := db.QueryRow(t.Context(),
		`SELECT settings->'telegram'->>'botToken' FROM integration_config WHERE distributor_id = $1`, tenant).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != "123:SECRET" {
		t.Errorf("the database holds %q, want the original token", stored)
	}
}

func TestIntegrationTestButton(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	admin.post(f.path("/integration/test/roomalert"), map[string]any{}).expect(http.StatusOK)
	admin.post(f.path("/integration/test/nonsense"), map[string]any{}).expect(http.StatusBadRequest)
}
