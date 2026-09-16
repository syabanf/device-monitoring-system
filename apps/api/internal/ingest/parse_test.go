package ingest

import (
	"testing"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
)

func TestParseWebhookReadsTheCloudPayload(t *testing.T) {
	raw := `{"alert_id":5731122,"event":"triggered","device":{"name":"IDM Margorejo 1","serial":"RA3-F88156-RA3S","mac":"00:80:a3:36:d1:db"},"sensor":{"name":"Sales Area Temp & RH","type":"TEMPERATURE_HUMIDITY","value":30.4,"unit":"°C"},"timestamp":"2026-09-07T13:28:00+07:00"}`
	e, err := ParseWebhook(raw)
	if err != nil {
		t.Fatal(err)
	}
	if e.Kind != "TRIGGERED" || e.ExternalID != "5731122" {
		t.Fatalf("kind/id: %+v", e)
	}
	if e.MAC != "00:80:A3:36:D1:DB" {
		t.Fatalf("MAC should be upper case for matching, got %q", e.MAC)
	}
	if e.SensorType != domain.SensorTempHumidity || e.Value != "30.4 °C" {
		t.Fatalf("sensor: %+v", e)
	}
	if e.At.Format("2006-01-02T15:04:05Z07:00") != "2026-09-07T13:28:00+07:00" {
		t.Fatalf("timestamp lost its offset: %s", e.At)
	}
}

func TestParseEmailReadsTheAlertMail(t *testing.T) {
	raw := "❌ Alert TRIGGERED ❌\nName : Surabaya RA3-F98909-RA3S\nLocation : Jl. Rungkut No. 45\nAlert ID : 5731123\nSensor Name : Front Door / Ext Sensor 1\nSensor Type : SWITCH\nTrigger Alarm : OPEN\nTrigger Time : 07-09-2026 03:12:40 WIB"
	e := ParseEmail(raw)
	if e.Kind != "TRIGGERED" || e.ExternalID != "5731123" {
		t.Fatalf("kind/id: %+v", e)
	}
	if e.DeviceSerial != "RA3-F98909-RA3S" {
		t.Fatalf("serial should come out of the name line, got %q", e.DeviceSerial)
	}
	if e.SensorType != domain.SensorDoor || e.Value != "OPEN" {
		t.Fatalf("sensor: %+v", e)
	}
	if got := e.At.Format("2006-01-02T15:04:05Z07:00"); got != "2026-09-07T03:12:40+07:00" {
		t.Fatalf("Indonesian time should keep +07:00, got %s", got)
	}
}

func TestParseEmailDetectsAClear(t *testing.T) {
	raw := "✅ Alert RESOLVED ✅\nName : Indomaret Margorejo 1\nAlert ID : 5695504\nSensor Name : 0 / EXT1 - Temp\nSensor Type : TEMPERATURE\nTrigger Alarm : 31.0600\nClear Value : 29.43\nClear Time : 18-04-2026 11:01:28 WIB"
	e := ParseEmail(raw)
	if e.Kind != "CLEARED" {
		t.Fatalf("want CLEARED, got %s", e.Kind)
	}
	if e.Value != "29.43" {
		t.Fatalf("a clear reports the clear value, got %q", e.Value)
	}
}

func TestMessageAndCategoryFollowTheSensor(t *testing.T) {
	cases := []struct {
		sensor   domain.SensorType
		value    string
		message  string
		category domain.AlertCategory
	}{
		{domain.SensorTempHumidity, "30.4 °C", "Temperature above 28.00 °C", domain.CategoryComfort},
		{domain.SensorTempHumidity, "73.2 %RH", "Humidity above 60.0 %RH", domain.CategoryComfort},
		{domain.SensorDoor, "OPEN", "Door opened outside operational hours", domain.CategorySecurity},
		{domain.SensorPower, "POWER LOST", "Main power lost", domain.CategorySecurity},
	}
	for _, c := range cases {
		if got := MessageFor(c.sensor, c.value); got != c.message {
			t.Errorf("%s: want %q, got %q", c.sensor, c.message, got)
		}
		if got := CategoryFor(c.sensor); got != c.category {
			t.Errorf("%s: want %s, got %s", c.sensor, c.category, got)
		}
	}
}
