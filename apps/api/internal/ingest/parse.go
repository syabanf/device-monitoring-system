// Package ingest is the blackbox: it accepts what the Room Alert cloud sends, normalises it
// against master data and opens or clears an alert.
package ingest

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
)

// Event is the one shape the rest of the pipeline works with, whatever the source was.
type Event struct {
	Source       string            `json:"source"`
	Kind         string            `json:"event"` // TRIGGERED or CLEARED
	ExternalID   string            `json:"externalAlertId"`
	DeviceName   string            `json:"deviceName"`
	DeviceSerial string            `json:"deviceSerial"`
	MAC          string            `json:"mac"`
	Location     string            `json:"location"`
	SensorName   string            `json:"sensorName"`
	SensorType   domain.SensorType `json:"sensorType"`
	Value        string            `json:"value"`
	At           time.Time         `json:"at"`
	Raw          string            `json:"-"`
}

type webhookPayload struct {
	AlertID any    `json:"alert_id"`
	Event   string `json:"event"`
	Device  struct {
		Name     string `json:"name"`
		Serial   string `json:"serial"`
		MAC      string `json:"mac"`
		Location string `json:"location"`
	} `json:"device"`
	Sensor struct {
		Name  string `json:"name"`
		Type  string `json:"type"`
		Value any    `json:"value"`
		Unit  string `json:"unit"`
	} `json:"sensor"`
	Timestamp string `json:"timestamp"`
}

// ParseWebhook reads the JSON the Room Alert account posts from its alert action.
func ParseWebhook(raw string) (Event, error) {
	var p webhookPayload
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return Event{}, fmt.Errorf("webhook body is not JSON: %w", err)
	}
	at := time.Now().UTC()
	if p.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, p.Timestamp); err == nil {
			at = parsed
		}
	}
	value := ""
	if p.Sensor.Value != nil {
		value = strings.TrimSpace(fmt.Sprintf("%v %s", p.Sensor.Value, p.Sensor.Unit))
	}
	return Event{
		Source:       "webhook",
		Kind:         kindOf(p.Event),
		ExternalID:   externalID(p.AlertID),
		DeviceName:   p.Device.Name,
		DeviceSerial: p.Device.Serial,
		MAC:          strings.ToUpper(p.Device.MAC),
		Location:     p.Device.Location,
		SensorName:   orDefault(p.Sensor.Name, "Sensor"),
		SensorType:   MapSensorType(p.Sensor.Type),
		Value:        value,
		At:           at,
		Raw:          raw,
	}, nil
}

var (
	fieldRe  = regexp.MustCompile(`(?im)^\s*([A-Za-z ]+?)\s*:\s*(.+)$`)
	serialRe = regexp.MustCompile(`(?i)\b(RA\d+[A-Z]?-[A-Z0-9-]+)\b`)
	timeRe   = regexp.MustCompile(`(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})`)
)

// ParseEmail reads the alert mail and the ANBot broadcast, which share a layout:
//
//	❌ Alert TRIGGERED ❌
//	Name : Surabaya RA3-F98909-RA3S
//	Sensor Type : SWITCH
//	Trigger Alarm : OPEN
//	Trigger Time : 07-09-2026 03:12:40 WIB
func ParseEmail(raw string) Event {
	fields := map[string]string{}
	for _, m := range fieldRe.FindAllStringSubmatch(raw, -1) {
		fields[strings.ToLower(strings.TrimSpace(m[1]))] = strings.TrimSpace(m[2])
	}

	firstLine := raw
	if idx := strings.Index(raw, "\n"); idx >= 0 {
		firstLine = raw[:idx]
	}
	cleared := strings.Contains(strings.ToUpper(firstLine), "RESOLVED") ||
		strings.Contains(strings.ToUpper(firstLine), "CLEARED") ||
		fields["clear value"] != ""

	value := fields["trigger alarm"]
	if value == "" {
		value = fields["trigger value"]
	}
	timeField := fields["trigger time"]
	if cleared {
		if v := fields["clear value"]; v != "" {
			value = v
		}
		if t := fields["clear time"]; t != "" {
			timeField = t
		}
	}

	name := orDefault(fields["name"], "Unknown device")
	serial := ""
	if m := serialRe.FindStringSubmatch(name); m != nil {
		serial = m[1]
	}

	kind := "TRIGGERED"
	if cleared {
		kind = "CLEARED"
	}
	return Event{
		Source:       "email",
		Kind:         kind,
		ExternalID:   fields["alert id"],
		DeviceName:   name,
		DeviceSerial: serial,
		Location:     fields["location"],
		SensorName:   orDefault(fields["sensor name"], "Sensor"),
		SensorType:   MapSensorType(fields["sensor type"]),
		Value:        value,
		At:           parseIndonesianTime(timeField),
		Raw:          raw,
	}
}

// MapSensorType folds the cloud's loose vocabulary onto the domain union.
func MapSensorType(raw string) domain.SensorType {
	key := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(raw), " ", "_"))
	switch {
	case key == "":
		return domain.SensorTemperature
	case strings.Contains(key, "HUMIDITY"), strings.Contains(key, "RH"):
		return domain.SensorTempHumidity
	case strings.Contains(key, "TEMPERATURE"), strings.Contains(key, "TEMP"):
		return domain.SensorTemperature
	case strings.Contains(key, "DOOR"), strings.Contains(key, "SWITCH"), strings.Contains(key, "ENTRY"):
		return domain.SensorDoor
	case strings.Contains(key, "MOTION"):
		return domain.SensorMotion
	case strings.Contains(key, "POWER"):
		return domain.SensorPower
	case strings.Contains(key, "PANIC"):
		return domain.SensorPanicButton
	default:
		return domain.SensorTemperature
	}
}

// CategoryFor splits the two points of view the dashboard shows.
func CategoryFor(t domain.SensorType) domain.AlertCategory {
	if t == domain.SensorTemperature || t == domain.SensorTempHumidity {
		return domain.CategoryComfort
	}
	return domain.CategorySecurity
}

// MessageFor is the wording outlet staff read on their phone.
func MessageFor(t domain.SensorType, value string) string {
	switch t {
	case domain.SensorTemperature, domain.SensorTempHumidity:
		if strings.Contains(value, "%") {
			return "Humidity above 60.0 %RH"
		}
		return "Temperature above 28.00 °C"
	case domain.SensorDoor:
		return "Door opened outside operational hours"
	case domain.SensorMotion:
		return "Motion detected outside operational hours"
	case domain.SensorPower:
		return "Main power lost"
	default:
		return "Panic button pressed"
	}
}

// Room Alert stamps local time as "20-04-2022 07:56:02 WIB".
func parseIndonesianTime(v string) time.Time {
	m := timeRe.FindStringSubmatch(v)
	if m == nil {
		if parsed, err := time.Parse(time.RFC3339, v); err == nil {
			return parsed
		}
		return time.Now().UTC()
	}
	iso := fmt.Sprintf("%s-%s-%sT%s:%s:%s+07:00", m[3], m[2], m[1], m[4], m[5], m[6])
	parsed, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		return time.Now().UTC()
	}
	return parsed
}

func kindOf(event string) string {
	if strings.HasPrefix(strings.ToLower(event), "clear") {
		return "CLEARED"
	}
	return "TRIGGERED"
}

func externalID(v any) string {
	if v == nil {
		return ""
	}
	if f, ok := v.(float64); ok {
		return fmt.Sprintf("%.0f", f)
	}
	return fmt.Sprintf("%v", v)
}

func orDefault(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}
