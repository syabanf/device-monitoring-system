// Package akcp connects AKCP sensorProbe+ units to this system. The units publish one MQTT
// message per sensor event, so this package parses the topic and its JSON body, matches the
// message to a sensor in master data, stores the reading and lets the alert engine judge it.
//
// The shapes follow the "SP+ and WTG MQTT Manual": topics carry five levels and the body is a
// compact JSON object holding a timestamp, an optional value and an optional status code.
package akcp

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// TopicFilter catches both event branches of every unit without reaching outside the sensor
// namespace. The broker fans out spp/<mac>/sensor/status_change/<compound id> and its
// value_change twin into this one subscription.
const TopicFilter = "spp/+/sensor/+/+"

const (
	EventStatus = "status_change"
	EventValue  = "value_change"
)

// Topic is what the five levels carry.
type Topic struct {
	DeviceMAC string // level 2, the unit's MAC as published, for example 000BDC01ADED
	Event     string // level 4
	Compound  string // level 5, for example 0.1.0.5.0
}

// forbidden are the characters MQTT reserves plus the control range. A unit never publishes
// them; a topic that carries one is malformed rather than unknown.
const forbidden = "+#/\x00"

// ParseTopic reads one published topic. The MAC and the compound id keep their leading zeros
// and their case, because they are the identity the unit was configured with.
func ParseTopic(topic string) (Topic, error) {
	parts := strings.Split(topic, "/")
	if len(parts) != 5 || parts[0] != "spp" || parts[2] != "sensor" {
		return Topic{}, fmt.Errorf("unsupported topic shape %q", topic)
	}
	t := Topic{DeviceMAC: parts[1], Event: parts[3], Compound: parts[4]}
	if t.Event != EventStatus && t.Event != EventValue {
		return Topic{}, fmt.Errorf("unknown event type %q", t.Event)
	}
	if !plausible(t.DeviceMAC) {
		return Topic{}, fmt.Errorf("invalid device id %q", t.DeviceMAC)
	}
	if !plausible(t.Compound) {
		return Topic{}, fmt.Errorf("invalid sensor key %q", t.Compound)
	}
	return t, nil
}

func plausible(v string) bool {
	return v != "" && len(v) <= 128 && !strings.ContainsAny(v, forbidden)
}

// Payload is the body the unit publishes. Value and Status are pointers because the unit sends
// three different messages: value with status, status alone, and value alone. Value stays nil
// both when the body carries none and when it carries an explicit null, which is a reading the
// unit could not take: neither one overwrites what the sensor last reported.
type Payload struct {
	At     time.Time
	Value  *float64
	Status *int
}

// ParsePayload reads the JSON body. The timestamp is unix seconds in the unit's clock; a body
// without one is stamped on arrival, which keeps a misconfigured unit from writing 1970.
//
// The fields are read from a map rather than a struct, because a struct cannot tell "value":
// null from a body that carries no value at all, and those mean different things to a unit.
func ParsePayload(raw []byte, arrived time.Time) (Payload, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return Payload{}, fmt.Errorf("body is not JSON: %w", err)
	}
	p := Payload{At: arrived.UTC()}

	if stamp, ok := fields["timestamp"]; ok {
		var seconds int64
		if err := json.Unmarshal(stamp, &seconds); err == nil && seconds > 0 {
			p.At = time.Unix(seconds, 0).UTC()
		}
	}
	if status, ok := fields["status"]; ok && string(status) != "null" {
		var code int
		if err := json.Unmarshal(status, &code); err != nil {
			return Payload{}, fmt.Errorf("status is not a number: %w", err)
		}
		p.Status = &code
	}
	if value, ok := fields["value"]; ok {
		if string(value) != "null" {
			var v float64
			if err := json.Unmarshal(value, &v); err != nil {
				return Payload{}, fmt.Errorf("value is not a number: %w", err)
			}
			p.Value = &v
		}
	}
	return p, nil
}

// statusNames are the codes in the manual's status table. A unit also emits 17, which the
// table does not define: that code keeps its number and gets no name, because inventing one
// would put a guess in front of the staff who read the alert.
var statusNames = map[int]string{
	1:  "NOSTATUS",
	2:  "SENSORNORMAL",
	3:  "HIGHWARNING",
	4:  "HIGHCRITICAL",
	5:  "LOWWARNING",
	6:  "LOWCRITICAL",
	7:  "SENSORERROR",
	8:  "SWITCH_LOW_OUT",
	9:  "SWITCH_HIGH_OUT",
	10: "NO_VOLT_PRESENT",
	11: "VOLT_PRESENT",
	12: "RESERVED",
	13: "STATUS_ACKED",
	14: "STATUS_OFFLINE",
	15: "UNREACHABLE",
}

// StatusName returns the manual's name for a code, or an empty string when the manual has none.
func StatusName(code int) string { return statusNames[code] }

// alarms are the codes that mean someone should look: the four analog bands, a broken sensor,
// and the two codes for a sensor the unit cannot reach.
var alarms = map[int]bool{3: true, 4: true, 5: true, 6: true, 7: true, 14: true, 15: true}

// StatusLabel is how a code reads in an alert: the manual's name, or the bare number when the
// manual does not list it.
func StatusLabel(code int) string {
	if name := StatusName(code); name != "" {
		return name
	}
	return fmt.Sprintf("status %d", code)
}
