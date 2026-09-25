package test

import (
	"context"
	"testing"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/akcp"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
)

// publish feeds one MQTT message through the ingestion path the subscriber runs, without a
// broker in the way.
func publish(t *testing.T, topic, body string, retained bool) akcp.Outcome {
	t.Helper()
	out, err := akcp.Handle(context.Background(), db, jobs.NewInlineQueue(), topic, []byte(body), retained, time.Now().UTC())
	if err != nil {
		t.Fatalf("handle %s: %v", topic, err)
	}
	return out
}

// akcpReset clears the seeded alerts, so a test sees only what its own messages opened.
func akcpReset(t *testing.T) fixture {
	t.Helper()
	f := reset(t)
	if _, err := db.Exec(context.Background(), `DELETE FROM alert`); err != nil {
		t.Fatal(err)
	}
	return f
}

func latestReading(t *testing.T, sensorID string) (temp, hum float64) {
	t.Helper()
	if err := db.QueryRow(context.Background(),
		`SELECT temperature_c, humidity_pct FROM reading WHERE sensor_id = $1 ORDER BY at DESC LIMIT 1`, sensorID).
		Scan(&temp, &hum); err != nil {
		t.Fatalf("no reading on %s: %v", sensorID, err)
	}
	return temp, hum
}

func TestMQTTValueLandsOnTheSensorBehindTheMAC(t *testing.T) {
	f := akcpReset(t)

	// The unit publishes its MAC without separators; master data holds it with colons.
	out := publish(t, "spp/000B DC00 0001/sensor/value_change/0.1.0.5.0", `{"value":24.5}`, false)
	if out.Matched() {
		t.Fatal("a MAC with spaces in it matched a device")
	}

	out = publish(t, "spp/000BDC000001/sensor/value_change/0.1.0.5.0", `{"timestamp":1790129371,"value":24.5,"status":2}`, false)
	if !out.Matched() || out.SensorID != f.SensorA {
		t.Fatalf("landed on %q, reason %q", out.SensorID, out.Reason)
	}
	if !out.Stored {
		t.Error("the value was not stored")
	}
	temp, _ := latestReading(t, f.SensorA)
	if temp != 24.5 {
		t.Errorf("stored %.1f °C, want 24.5", temp)
	}

	// Humidity arrives on its own key and must not wipe the temperature beside it.
	publish(t, "spp/000BDC000001/sensor/value_change/0.1.0.5.1", `{"timestamp":1790129381,"value":67}`, false)
	temp, hum := latestReading(t, f.SensorA)
	if temp != 24.5 || hum != 67 {
		t.Errorf("the pair reads %.1f °C / %.0f %%RH, want 24.5 and 67", temp, hum)
	}

	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM device WHERE id = $1`, f.DeviceA).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "online" {
		t.Errorf("the unit is %q after publishing, want online", status)
	}
}

func TestMQTTStatusCodeRaisesAndClearsAnAlert(t *testing.T) {
	akcpReset(t)

	// HIGHCRITICAL, with a value the limits here would still call normal: the unit watches its
	// own limits and this system trusts that.
	raised := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.0", `{"timestamp":1790129400,"value":26.0,"status":4}`, false)
	if raised.Raised == nil {
		t.Fatalf("HIGHCRITICAL opened no alert, reason %q", raised.Reason)
	}

	// A second critical while the first is open must not open a duplicate.
	again := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.0", `{"timestamp":1790129460,"value":26.4,"status":4}`, false)
	if again.Raised != nil {
		t.Error("a second critical opened another alert")
	}

	cleared := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.0", `{"timestamp":1790129520,"value":24.0,"status":2}`, false)
	if cleared.Cleared == nil || *cleared.Cleared != *raised.Raised {
		t.Fatalf("SENSORNORMAL closed %v, want alert %d", cleared.Cleared, *raised.Raised)
	}

	var alertStatus, message, triggerValue string
	if err := db.QueryRow(context.Background(),
		`SELECT status, message, trigger_value FROM alert WHERE id = $1`, *raised.Raised).
		Scan(&alertStatus, &message, &triggerValue); err != nil {
		t.Fatal(err)
	}
	if alertStatus != "RESOLVED" {
		t.Errorf("the alert is %s", alertStatus)
	}
	if message != "Unit reported HIGHCRITICAL" || triggerValue != "26.00 °C" {
		t.Errorf("the alert reads %q at %q", message, triggerValue)
	}
}

func TestMQTTUnknownStatusCodeIsStoredWithoutAName(t *testing.T) {
	akcpReset(t)

	// Code 17 shows up on real units and the manual does not define it, so it opens nothing.
	out := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.0", `{"timestamp":1790129600,"value":25.0,"status":17}`, false)
	if !out.Matched() || out.Raised != nil {
		t.Errorf("code 17 was treated as an alarm: %+v", out)
	}
	if !out.Stored {
		t.Error("the value beside the unknown status was dropped")
	}
}

func TestMQTTParksWhatItCannotPlace(t *testing.T) {
	akcpReset(t)
	ctx := context.Background()

	var topics []string
	for _, c := range []struct{ name, topic, body string }{
		{"unknown unit", "spp/00FFFFFFFFFF/sensor/value_change/0.1.0.5.0", `{"value":21}`},
		{"unknown sensor key", "spp/000BDC000001/sensor/value_change/7.7.7.7.7", `{"value":21}`},
		{"topic shape", "spp/000BDC000001/sensor/value_change", `{"value":21}`},
		{"body", "spp/000BDC000001/sensor/value_change/0.1.0.5.0", `not json`},
	} {
		if out := publish(t, c.topic, c.body, false); out.Matched() {
			t.Errorf("%s was accepted", c.name)
		}
		topics = append(topics, c.topic)
	}

	// Count only this test's topics: a running stack's akcp-demo publisher may share the database
	// and park its own messages here while the suite runs.
	var parked int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM unmatched_event WHERE source = 'akcp'
		AND split_part(raw, ' ', 1) = ANY($1)`, topics).Scan(&parked); err != nil {
		t.Fatal(err)
	}
	if parked != 4 {
		t.Errorf("parked %d messages, want 4", parked)
	}
}

func TestMQTTRetainedReplayDoesNotOverwriteLiveState(t *testing.T) {
	f := akcpReset(t)

	publish(t, "spp/000BDC000001/sensor/value_change/0.1.0.5.0", `{"timestamp":1790130000,"value":25.0}`, false)
	// The broker replays what it held from before the reconnect.
	replay := publish(t, "spp/000BDC000001/sensor/value_change/0.1.0.5.0", `{"timestamp":1790129000,"value":19.0}`, true)
	if replay.Stored {
		t.Error("a retained message older than the live reading was stored")
	}
	if temp, _ := latestReading(t, f.SensorA); temp != 25 {
		t.Errorf("the live reading is %.1f °C, want the 25.0 the unit published", temp)
	}

	// A retained message newer than anything stored is still real data.
	if ahead := publish(t, "spp/000BDC000001/sensor/value_change/0.1.0.5.0", `{"timestamp":1790131000,"value":26.0}`, true); !ahead.Stored {
		t.Error("a retained message newer than the live reading was dropped")
	}
}

func TestMQTTExternalKeyBindsAnUnknownSensorKey(t *testing.T) {
	f := akcpReset(t)

	topic := "spp/000BDC000001/sensor/value_change/3.2.1.0.4"
	if out := publish(t, topic, `{"value":22}`, false); out.Matched() {
		t.Fatal("an unbound sensor key matched a sensor")
	}

	if _, err := db.Exec(context.Background(), `UPDATE sensor SET external_key = '3.2.1.0.4' WHERE id = $1`, f.SensorA); err != nil {
		t.Fatal(err)
	}
	out := publish(t, topic, `{"value":22}`, false)
	if !out.Matched() || out.SensorID != f.SensorA || !out.Stored {
		t.Fatalf("the bound key landed on %q, reason %q", out.SensorID, out.Reason)
	}
	if temp, _ := latestReading(t, f.SensorA); temp != 22 {
		t.Errorf("stored %.1f °C, want 22", temp)
	}
}

func TestMQTTNormalClosesOnlyTheAlertItsOwnKeyOpened(t *testing.T) {
	f := akcpReset(t)
	ctx := context.Background()
	isOpen := func(id int64) bool {
		t.Helper()
		var status string
		if err := db.QueryRow(ctx, `SELECT status FROM alert WHERE id = $1`, id).Scan(&status); err != nil {
			t.Fatal(err)
		}
		return status != "RESOLVED" && status != "VERIFIED"
	}

	// A humidity breach the limits here caught, with no unit verdict behind it.
	if _, err := db.Exec(ctx, `INSERT INTO alert (id, distributor_id, outlet_id, device_id, sensor_id, sensor_name,
		sensor_type, category, status, trigger_value, trigger_time, message, channels)
		VALUES (9500,$1,$2,$3,$4,'Sales Area Temp & RH','TEMPERATURE_HUMIDITY','COMFORT','UNACKNOWLEDGED','68.0 %RH',now(),
		'Humidity above 60.0 %RH','{app}')`, tenant, f.OutletA, f.DeviceA, f.SensorA); err != nil {
		t.Fatal(err)
	}
	if out := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.0", `{"value":24.0,"status":2}`, false); out.Cleared != nil {
		t.Error("the temperature key's SENSORNORMAL closed a humidity breach")
	}
	if !isOpen(9500) {
		t.Fatal("the humidity breach was resolved")
	}
	if _, err := db.Exec(ctx, `DELETE FROM alert`); err != nil {
		t.Fatal(err)
	}

	// The humidity key's own alarm stays open while the temperature key reports normal.
	raised := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.1", `{"value":71,"status":4}`, false)
	if raised.Raised == nil {
		t.Fatalf("the humidity key's HIGHCRITICAL opened nothing, reason %q", raised.Reason)
	}
	if out := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.0", `{"value":24.0,"status":2}`, false); out.Cleared != nil {
		t.Error("the temperature key's SENSORNORMAL closed the humidity key's alarm")
	}
	cleared := publish(t, "spp/000BDC000001/sensor/status_change/0.1.0.5.1", `{"value":55,"status":2}`, false)
	if cleared.Cleared == nil || *cleared.Cleared != *raised.Raised {
		t.Errorf("the humidity key's SENSORNORMAL closed %v, want %d", cleared.Cleared, *raised.Raised)
	}
}
