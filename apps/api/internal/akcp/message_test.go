package akcp

import (
	"testing"
	"time"
)

func TestParseTopicReadsTheFiveLevels(t *testing.T) {
	got, err := ParseTopic("spp/000BDC01ADED/sensor/status_change/0.1.0.5.0")
	if err != nil {
		t.Fatalf("a well formed topic was rejected: %v", err)
	}
	if got.DeviceMAC != "000BDC01ADED" || got.Event != EventStatus || got.Compound != "0.1.0.5.0" {
		t.Errorf("parsed %+v", got)
	}
}

func TestParseTopicRejectsWhatTheUnitsNeverPublish(t *testing.T) {
	for _, topic := range []string{
		"spp/000BDC01ADED/sensor/status_change",             // the parent topic, four levels
		"spp/000BDC01ADED/sensor/status_change/0.1.0.5.0/x", // six levels
		"spp/000BDC01ADED/device/status_change/0.1.0.5.0",   // another namespace
		"spp/000BDC01ADED/sensor/config_change/0.1.0.5.0",   // an event this system does not read
		"spp//sensor/status_change/0.1.0.5.0",               // no device id
		"other/000BDC01ADED/sensor/status_change/0.1.0.5.0", // another protocol
	} {
		if _, err := ParseTopic(topic); err == nil {
			t.Errorf("%q was accepted", topic)
		}
	}
}

func TestParsePayloadSeparatesMissingValuesFromNullOnes(t *testing.T) {
	arrived := time.Date(2026, 9, 23, 10, 0, 0, 0, time.UTC)

	full, err := ParsePayload([]byte(`{"timestamp":1790129371,"value":26.0,"status":2}`), arrived)
	if err != nil {
		t.Fatal(err)
	}
	if full.Value == nil || *full.Value != 26 || full.Status == nil || *full.Status != 2 {
		t.Errorf("parsed %+v", full)
	}
	if want := time.Unix(1790129371, 0).UTC(); !full.At.Equal(want) {
		t.Errorf("stamped %s, want the unit's %s", full.At, want)
	}

	statusOnly, err := ParsePayload([]byte(`{"timestamp":1790129374,"status":4}`), arrived)
	if err != nil {
		t.Fatal(err)
	}
	if statusOnly.Value != nil {
		t.Errorf("a status-only body carried a value: %+v", statusOnly)
	}

	// Freezing point is a reading, not an absent one.
	zero, err := ParsePayload([]byte(`{"timestamp":1790129380,"value":0,"status":2}`), arrived)
	if err != nil {
		t.Fatal(err)
	}
	if zero.Value == nil || *zero.Value != 0 {
		t.Errorf("zero came back as %+v", zero.Value)
	}

	// An explicit null is a reading the unit could not take.
	null, err := ParsePayload([]byte(`{"timestamp":1790129385,"value":null,"status":4}`), arrived)
	if err != nil {
		t.Fatal(err)
	}
	if null.Value != nil || null.Status == nil || *null.Status != 4 {
		t.Errorf("null came back as %+v", null)
	}

	noStamp, err := ParsePayload([]byte(`{"value":21.5}`), arrived)
	if err != nil {
		t.Fatal(err)
	}
	if !noStamp.At.Equal(arrived) {
		t.Errorf("a body without a timestamp was stamped %s, want the arrival time", noStamp.At)
	}

	if _, err := ParsePayload([]byte(`not json`), arrived); err == nil {
		t.Error("a body that is not JSON was accepted")
	}
}

func TestStatusNamesFollowTheManual(t *testing.T) {
	if got := StatusName(4); got != "HIGHCRITICAL" {
		t.Errorf("code 4 is %q", got)
	}
	// The units emit 17, which the manual's table does not define.
	if got := StatusName(17); got != "" {
		t.Errorf("code 17 was given the name %q", got)
	}
	if got := StatusLabel(17); got != "status 17" {
		t.Errorf("code 17 reads as %q", got)
	}
	if alarms[17] || alarms[2] || !alarms[4] {
		t.Error("the alarming codes are wrong")
	}
}
