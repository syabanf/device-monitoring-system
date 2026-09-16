// Package domain mirrors packages/types. The JSON tags are the wire contract the dashboard
// and the mobile app already read, so they stay camelCase and must not drift.
package domain

import "time"

type (
	SensorType      string
	PortKind        string
	DeviceModel     string
	DeviceStatus    string
	AlertStatus     string
	AlertCategory   string
	EmployeeRole    string
	Channel         string
	TicketStatus    string
	TicketPriority  string
	MaintenanceKind string
)

const (
	SensorTemperature  SensorType = "TEMPERATURE"
	SensorTempHumidity SensorType = "TEMPERATURE_HUMIDITY"
	SensorDoor         SensorType = "DOOR"
	SensorMotion       SensorType = "MOTION"
	SensorPower        SensorType = "POWER"
	SensorPanicButton  SensorType = "PANIC_BUTTON"

	PortDigital PortKind = "digital"
	PortSwitch  PortKind = "switch"
	PortAnalog  PortKind = "analog"

	DeviceOnline  DeviceStatus = "online"
	DeviceOffline DeviceStatus = "offline"

	AlertUnacknowledged AlertStatus = "UNACKNOWLEDGED"
	AlertAcknowledged   AlertStatus = "ACKNOWLEDGED"
	AlertResponding     AlertStatus = "RESPONDING"
	AlertResolved       AlertStatus = "RESOLVED"
	AlertVerified       AlertStatus = "VERIFIED"

	CategoryComfort  AlertCategory = "COMFORT"
	CategorySecurity AlertCategory = "SECURITY"

	TicketOpen       TicketStatus = "OPEN"
	TicketScheduled  TicketStatus = "SCHEDULED"
	TicketInProgress TicketStatus = "IN_PROGRESS"
	TicketDone       TicketStatus = "DONE"
)

type FloorPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Outlet struct {
	ID            string  `json:"id"`
	DistributorID string  `json:"distributorId"`
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	Address       string  `json:"address"`
	City          string  `json:"city"`
	Province      string  `json:"province"`
	Lat           float64 `json:"lat"`
	Lng           float64 `json:"lng"`
	MapsURL       string  `json:"mapsUrl"`
	OpenTime      string  `json:"openTime"`
	CloseTime     string  `json:"closeTime"`
	Timezone      string  `json:"timezone"`
	Phone         string  `json:"phone"`
}

type DeviceTypePort struct {
	Kind  PortKind `json:"kind"`
	Count int      `json:"count"`
}

type DeviceType struct {
	ID                      string           `json:"id"`
	Model                   DeviceModel      `json:"model"`
	Name                    string           `json:"name"`
	Vendor                  string           `json:"vendor"`
	Ports                   []DeviceTypePort `json:"ports"`
	BuiltInSensors          []SensorType     `json:"builtInSensors"`
	Description             string           `json:"description"`
	PriceIDR                int64            `json:"priceIdr"`
	LatestFirmware          string           `json:"latestFirmware"`
	MaintenanceIntervalDays int              `json:"maintenanceIntervalDays"`
}

type DevicePort struct {
	Index    int      `json:"index"`
	Kind     PortKind `json:"kind"`
	Label    string   `json:"label"`
	SensorID *string  `json:"sensorId"`
}

type Device struct {
	ID                string       `json:"id"`
	OutletID          string       `json:"outletId"`
	DeviceTypeID      string       `json:"deviceTypeId"`
	Model             DeviceModel  `json:"model"`
	Serial            string       `json:"serial"`
	MAC               string       `json:"mac"`
	IP                string       `json:"ip"`
	Firmware          string       `json:"firmware"`
	Status            DeviceStatus `json:"status"`
	LastPushAt        time.Time    `json:"lastPushAt"`
	InstalledAt       time.Time    `json:"installedAt"`
	PushIntervalSec   int          `json:"pushIntervalSec"`
	Ports             []DevicePort `json:"ports"`
	Channels          []Channel    `json:"channels"`
	WarrantyUntil     time.Time    `json:"warrantyUntil"`
	LastMaintenanceAt *time.Time   `json:"lastMaintenanceAt"`
	NextMaintenanceAt time.Time    `json:"nextMaintenanceAt"`
	UptimePct         float64      `json:"uptimePct"`
	SensorFaults      int          `json:"sensorFaults"`
	Floor             FloorPoint   `json:"floor"`
}

type SensorThresholds struct {
	Min         *float64 `json:"min,omitempty"`
	Max         *float64 `json:"max,omitempty"`
	HumidityMin *float64 `json:"humidityMin,omitempty"`
	HumidityMax *float64 `json:"humidityMax,omitempty"`
}

type Sensor struct {
	ID         string            `json:"id"`
	DeviceID   string            `json:"deviceId"`
	OutletID   string            `json:"outletId"`
	Name       string            `json:"name"`
	Type       SensorType        `json:"type"`
	PortKind   PortKind          `json:"portKind"`
	PortIndex  int               `json:"portIndex"`
	Unit       string            `json:"unit"`
	Thresholds *SensorThresholds `json:"thresholds,omitempty"`
	Enabled    bool              `json:"enabled"`
	Floor      FloorPoint        `json:"floor"`
}

type AlertResponse struct {
	EmployeeID          string    `json:"employeeId"`
	Notes               string    `json:"notes"`
	PhotoURLs           []string  `json:"photoUrls"`
	RespondedAt         time.Time `json:"respondedAt"`
	ResponseDurationSec int       `json:"responseDurationSec"`
}

type Alert struct {
	ID                 int64          `json:"id"`
	DistributorID      string         `json:"distributorId"`
	OutletID           string         `json:"outletId"`
	DeviceID           string         `json:"deviceId"`
	SensorID           string         `json:"sensorId"`
	SensorName         string         `json:"sensorName"`
	SensorType         SensorType     `json:"sensorType"`
	Category           AlertCategory  `json:"category"`
	Status             AlertStatus    `json:"status"`
	TriggerValue       string         `json:"triggerValue"`
	TriggerTime        time.Time      `json:"triggerTime"`
	ClearValue         *string        `json:"clearValue"`
	ClearTime          *time.Time     `json:"clearTime"`
	Message            string         `json:"message"`
	Response           *AlertResponse `json:"response"`
	Channels           []Channel      `json:"channels"`
	AssigneeEmployeeID *string        `json:"assigneeEmployeeId"`
	AcknowledgedAt     *time.Time     `json:"acknowledgedAt"`
	RespondingAt       *time.Time     `json:"respondingAt"`
	ResolvedAt         *time.Time     `json:"resolvedAt"`
	VerifiedAt         *time.Time     `json:"verifiedAt"`
}

type Ticket struct {
	ID            string          `json:"id"`
	DistributorID string          `json:"distributorId"`
	OutletID      string          `json:"outletId"`
	DeviceID      string          `json:"deviceId"`
	SensorID      *string         `json:"sensorId"`
	Type          MaintenanceKind `json:"type"`
	Priority      TicketPriority  `json:"priority"`
	Status        TicketStatus    `json:"status"`
	Title         string          `json:"title"`
	Description   string          `json:"description"`
	TechnicianID  *string         `json:"technicianId"`
	CreatedAt     time.Time       `json:"createdAt"`
	ScheduledAt   *time.Time      `json:"scheduledAt"`
	CompletedAt   *time.Time      `json:"completedAt"`
	PartsUsed     []string        `json:"partsUsed"`
	Notes         *string         `json:"notes"`
	PhotoURLs     []string        `json:"photoUrls"`
}

// Postgres stores the multi-value columns as text[], which pgx maps to []string. These keep the
// conversion in one place so repos never sprinkle casts.

func SensorTypesFrom(v []string) []SensorType {
	out := make([]SensorType, len(v))
	for i, s := range v {
		out[i] = SensorType(s)
	}
	return out
}

func SensorTypesText(v []SensorType) []string {
	out := make([]string, len(v))
	for i, s := range v {
		out[i] = string(s)
	}
	return out
}

func ChannelsFrom(v []string) []Channel {
	out := make([]Channel, len(v))
	for i, s := range v {
		out[i] = Channel(s)
	}
	return out
}

func ChannelsText(v []Channel) []string {
	out := make([]string, len(v))
	for i, c := range v {
		out[i] = string(c)
	}
	return out
}
