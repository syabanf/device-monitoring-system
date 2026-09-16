package test

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// hook posts a raw body to a webhook with the HMAC Room Alert would send.
func hook(t *testing.T, path, body, secret string) response {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	if secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(body))
		req.Header.Set("X-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return response{t: t, Status: rec.Code, Body: rec.Body.Bytes()}
}

const triggerBody = `{"alert_id":"RA-77001","event":"TRIGGERED","device":{"name":"Alpha RA3","serial":"RA3-AAA-RA3S","mac":"00:80:A3:00:00:01","location":"Sales Area"},"sensor":{"name":"Sales Area Temp & RH","type":"TEMPERATURE","value":31.4,"unit":"C"},"timestamp":"2026-09-16T09:00:00Z"}`

func TestWebhookRaisesAndClearsAnAlert(t *testing.T) {
	f := reset(t)

	first := hook(t, "/webhooks/roomalert", triggerBody, hookSecret).expect(http.StatusAccepted)
	if first.field("accepted") != true {
		t.Fatalf("the webhook was refused: %s", first.Body)
	}
	id := first.num("alertId")

	// Room Alert retries; the external id keeps that from doubling the alert.
	if again := hook(t, "/webhooks/roomalert", triggerBody, hookSecret).expect(http.StatusAccepted).num("alertId"); again != id {
		t.Errorf("a retry raised a second alert: %v then %v", id, again)
	}

	clearBody := `{"alert_id":"RA-77001","event":"CLEARED","device":{"serial":"RA3-AAA-RA3S","mac":"00:80:A3:00:00:01"},"sensor":{"name":"Sales Area Temp & RH","type":"TEMPERATURE","value":26.1,"unit":"C"},"timestamp":"2026-09-16T09:30:00Z"}`
	hook(t, "/webhooks/roomalert", clearBody, hookSecret).expect(http.StatusAccepted)

	alert := as(t, f.AdminToken).get(f.path("/alerts?status=RESOLVED")).expect(http.StatusOK)
	found := false
	for _, row := range alert.items() {
		if row.(map[string]any)["id"] == id {
			found = true
		}
	}
	if !found {
		t.Error("the cleared alert did not move to RESOLVED")
	}
}

func TestWebhookSignature(t *testing.T) {
	reset(t)

	// A body signed with the wrong key is refused.
	hook(t, "/webhooks/roomalert", triggerBody, "wrong-secret").expect(http.StatusUnauthorized)
	// Outside production an unsigned call still works, which is how the local smoke script runs.
	hook(t, "/webhooks/roomalert", triggerBody, "").expect(http.StatusAccepted)
	hook(t, "/webhooks/roomalert", "not json", hookSecret).expect(http.StatusBadRequest)
}

func TestWebhookFromAnUnknownDeviceIsParked(t *testing.T) {
	f := reset(t)
	body := `{"alert_id":"RA-77002","event":"TRIGGERED","device":{"name":"Ghost","serial":"RA3-ZZZ-RA3S","mac":"00:80:A3:FF:FF:FF"},"sensor":{"name":"Temp","type":"TEMPERATURE","value":31.4,"unit":"C"},"timestamp":"2026-09-16T09:00:00Z"}`

	refused := hook(t, "/webhooks/roomalert", body, hookSecret).expect(http.StatusUnprocessableEntity)
	if refused.field("accepted") == true {
		t.Error("an unknown device must not raise an alert")
	}

	parked := as(t, f.AdminToken).get(f.path("/integration/unmatched")).expect(http.StatusOK).items()
	if len(parked) != 1 {
		t.Fatalf("want 1 unmatched event, got %d", len(parked))
	}
	if got := parked[0].(map[string]any)["source"]; got != "webhook" {
		t.Errorf("the unmatched row names source %v", got)
	}
}

func TestEmailWebhookParsesTheAlertMail(t *testing.T) {
	f := reset(t)
	mail := "Alert TRIGGERED\nName : Alpha RA3-AAA-RA3S\nLocation : Sales Area\nSensor Name : Sales Area Temp & RH\nSensor Type : TEMPERATURE\nTrigger Value : 31.4 C\nTrigger Time : 16-09-2026 09:00:00 WIB\n"

	accepted := hook(t, "/webhooks/email", mail, hookSecret).expect(http.StatusAccepted)
	if accepted.field("accepted") != true {
		t.Fatalf("the mail was refused: %s", accepted.Body)
	}

	alerts := as(t, f.AdminToken).get(f.path("/alerts?status=UNACKNOWLEDGED")).expect(http.StatusOK).items()
	if len(alerts) != 3 {
		t.Errorf("the mail should add one alert to the two seeded, got %d", len(alerts))
	}
}

func TestReadingPushStoresSamplesAndMarksTheDeviceOnline(t *testing.T) {
	f := reset(t)
	body := `{"deviceSerial":"RA3-AAA-RA3S","readings":[{"sensorName":"Sales Area Temp & RH","temperatureC":27.4,"humidityPct":55.1,"at":"2026-09-16T10:00:00Z"},{"sensorId":"sen-a","temperatureC":27.6,"humidityPct":55.4,"at":"2026-09-16T10:05:00Z"}]}`

	pushed := hook(t, "/webhooks/readings", body, hookSecret).expect(http.StatusAccepted)
	if got := pushed.num("accepted"); got != 2 {
		t.Errorf("want 2 samples stored, got %v", got)
	}

	admin := as(t, f.AdminToken)
	latest := admin.get(f.path("/readings/latest?outletId=" + f.OutletA)).expect(http.StatusOK).items()
	if len(latest) != 1 {
		t.Fatalf("want the newest row of 1 sensor, got %d", len(latest))
	}
	if got := latest[0].(map[string]any)["temperatureC"]; got != 27.6 {
		t.Errorf("the newest sample reads %v, want 27.6", got)
	}
	if got := admin.get(f.path("/devices/" + f.DeviceA)).expect(http.StatusOK).str("device.status"); got != "online" {
		t.Errorf("a push should mark the device online, got %s", got)
	}

	// A sample the device does not own is skipped rather than rejected.
	strayed := `{"mac":"00:80:A3:00:00:01","readings":[{"sensorId":"sen-c","temperatureC":1,"humidityPct":1}]}`
	if got := hook(t, "/webhooks/readings", strayed, hookSecret).expect(http.StatusAccepted).num("accepted"); got != 0 {
		t.Errorf("want 0 samples stored, got %v", got)
	}

	unknown := `{"deviceSerial":"RA3-NOPE","readings":[{"sensorId":"sen-a","temperatureC":1,"humidityPct":1}]}`
	hook(t, "/webhooks/readings", unknown, hookSecret).expect(http.StatusUnprocessableEntity)
	hook(t, "/webhooks/readings", `{"readings":[]}`, hookSecret).expect(http.StatusBadRequest)
}

// The seeded sensor carries an 18 to 28 °C band, so a push outside it opens an alert and a push
// back inside closes it.
func TestReadingsOutsideTheLimitsRaiseAndClearAnAlert(t *testing.T) {
	f := reset(t)
	admin := as(t, f.AdminToken)

	hot := `{"deviceSerial":"RA3-AAA-RA3S","readings":[{"sensorId":"sen-a","temperatureC":31.2,"humidityPct":55,"at":"2026-09-16T11:00:00Z"}]}`

	// The fixture leaves an open alert on this sensor, and one open alert per sensor is the rule.
	if quiet := hook(t, "/webhooks/readings", hot, hookSecret).expect(http.StatusAccepted); quiet.field("raised") != nil {
		t.Fatalf("a sensor with an open alert got a second one: %s", quiet.Body)
	}
	admin.post("/alerts/9001/status", map[string]any{"status": "RESOLVED"}).expect(http.StatusOK)
	before := len(admin.get(f.path("/alerts?status=UNACKNOWLEDGED")).expect(http.StatusOK).items())

	raised := hook(t, "/webhooks/readings", hot, hookSecret).expect(http.StatusAccepted)
	ids, ok := raised.field("raised").([]any)
	if !ok || len(ids) != 1 {
		t.Fatalf("want 1 alert raised, got %s", raised.Body)
	}
	alertID := int(ids[0].(float64))

	alert := admin.get(fmt.Sprintf("/alerts/%d", alertID)).expect(http.StatusOK)
	if got := alert.str("message"); got != "Temperature above the 28.0 °C limit" {
		t.Errorf("the alert reads %q", got)
	}
	if got := alert.str("triggerValue"); got != "31.20 °C" {
		t.Errorf("the trigger value reads %q", got)
	}

	// A second push while the alert is open must not raise another one.
	again := hook(t, "/webhooks/readings", hot, hookSecret).expect(http.StatusAccepted)
	if again.field("raised") != nil {
		t.Errorf("a repeated breach opened a second alert: %s", again.Body)
	}

	cool := `{"deviceSerial":"RA3-AAA-RA3S","readings":[{"sensorId":"sen-a","temperatureC":24.0,"humidityPct":50,"at":"2026-09-16T11:30:00Z"}]}`
	cleared := hook(t, "/webhooks/readings", cool, hookSecret).expect(http.StatusAccepted)
	if got := cleared.field("cleared").([]any); len(got) != 1 || int(got[0].(float64)) != alertID {
		t.Fatalf("want alert %d cleared, got %v", alertID, got)
	}
	if got := admin.get(fmt.Sprintf("/alerts/%d", alertID)).expect(http.StatusOK).str("status"); got != "RESOLVED" {
		t.Errorf("the alert is %s", got)
	}

	after := len(admin.get(f.path("/alerts?status=UNACKNOWLEDGED")).expect(http.StatusOK).items())
	if after != before {
		t.Errorf("the open list went from %d to %d", before, after)
	}
}

func TestReadingBelowTheLowerLimitRaisesAnAlert(t *testing.T) {
	f := reset(t)
	as(t, f.AdminToken).post("/alerts/9001/status", map[string]any{"status": "RESOLVED"}).expect(http.StatusOK)

	cold := `{"deviceSerial":"RA3-AAA-RA3S","readings":[{"sensorId":"sen-a","temperatureC":4.5,"humidityPct":45,"at":"2026-09-16T11:00:00Z"}]}`
	raised := hook(t, "/webhooks/readings", cold, hookSecret).expect(http.StatusAccepted)
	ids, ok := raised.field("raised").([]any)
	if !ok || len(ids) != 1 {
		t.Fatalf("want 1 alert raised, got %s", raised.Body)
	}
	alert := as(t, f.AdminToken).get(fmt.Sprintf("/alerts/%d", int(ids[0].(float64)))).expect(http.StatusOK)
	if got := alert.str("message"); got != "Temperature below the 18.0 °C limit" {
		t.Errorf("the alert reads %q", got)
	}
}

func TestIngestionWritesTheRequestLog(t *testing.T) {
	f := reset(t)
	hook(t, "/webhooks/roomalert", triggerBody, hookSecret).expect(http.StatusAccepted)

	entries := as(t, f.AdminToken).get(f.path("/integration/request-log")).expect(http.StatusOK).items()
	if len(entries) != 1 {
		t.Fatalf("want 1 log entry, got %d", len(entries))
	}
	row := entries[0].(map[string]any)
	if row["path"] != "/webhooks/roomalert" || row["direction"] != "inbound" {
		t.Errorf("the log entry reads %v", row)
	}
}
