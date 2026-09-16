package domain_test

import (
	"testing"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
)

func f(v float64) *float64 { return &v }

func TestThresholdCheck(t *testing.T) {
	band := &domain.SensorThresholds{Min: f(18), Max: f(28), HumidityMin: f(30), HumidityMax: f(60)}

	cases := []struct {
		name        string
		temp, hum   float64
		hasHumidity bool
		want        string // "" means the reading sits inside the band
	}{
		{name: "inside", temp: 24, hum: 45, hasHumidity: true},
		{name: "temperature above", temp: 29.4, hum: 45, hasHumidity: true, want: "Temperature above the 28.0 °C limit"},
		{name: "temperature below", temp: 2.5, hum: 45, hasHumidity: true, want: "Temperature below the 18.0 °C limit"},
		{name: "humidity above", temp: 24, hum: 72, hasHumidity: true, want: "Humidity above the 60.0 %RH limit"},
		{name: "humidity below", temp: 24, hum: 12, hasHumidity: true, want: "Humidity below the 30.0 %RH limit"},
		{name: "temperature wins over humidity", temp: 31, hum: 72, hasHumidity: true, want: "Temperature above the 28.0 °C limit"},
		{name: "humidity ignored on a temperature-only sensor", temp: 24, hum: 0, hasHumidity: false},
		{name: "exactly on the limit is inside", temp: 28, hum: 60, hasHumidity: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			breach := band.Check(c.temp, c.hum, c.hasHumidity)
			if c.want == "" {
				if breach != nil {
					t.Fatalf("want no breach, got %q", breach.Message())
				}
				return
			}
			if breach == nil {
				t.Fatalf("want %q, got no breach", c.want)
			}
			if got := breach.Message(); got != c.want {
				t.Errorf("want %q, got %q", c.want, got)
			}
		})
	}
}

func TestOneSidedBandAndNoBand(t *testing.T) {
	var none *domain.SensorThresholds
	if none.Check(99, 99, true) != nil {
		t.Error("a sensor with no limits never breaches")
	}
	upperOnly := &domain.SensorThresholds{Max: f(8)}
	if upperOnly.Check(-40, 0, false) != nil {
		t.Error("an unset lower limit must not fire")
	}
	if b := upperOnly.Check(9, 0, false); b == nil || b.Reading() != "9.00 °C" {
		t.Errorf("want the sample in the trigger value, got %v", b)
	}
}
