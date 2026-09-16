package devices

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// sensorSpec is the standard Indomaret outlet loadout, the same list the admin dialog offers.
type sensorSpec struct {
	Type     domain.SensorType
	Name     string
	PortKind domain.PortKind
	X, Y     float64
}

var defaultSensors = []sensorSpec{
	{domain.SensorTempHumidity, "Sales Area Temp & RH", domain.PortDigital, 50, 52},
	{domain.SensorTemperature, "Cooler Temp", domain.PortDigital, 12, 52},
	{domain.SensorDoor, "Front Door", domain.PortSwitch, 50, 91},
	{domain.SensorMotion, "Sales Area Motion", domain.PortSwitch, 52, 36},
	{domain.SensorPower, "Main Power", domain.PortSwitch, 92, 40},
	{domain.SensorPanicButton, "Cashier Panic Button", domain.PortSwitch, 84, 86},
}

type CreateInput struct {
	OutletID     string              `json:"outletId"`
	DeviceTypeID string              `json:"deviceTypeId"`
	Serial       string              `json:"serial"`
	IP           string              `json:"ip"`
	SensorTypes  []domain.SensorType `json:"sensorTypes"`
}

func (i CreateInput) Validate() error {
	if i.OutletID == "" || i.DeviceTypeID == "" {
		return fmt.Errorf("outletId and deviceTypeId are required")
	}
	for _, t := range i.SensorTypes {
		if err := enabledType(t); err != nil {
			return err
		}
	}
	return nil
}

func enabledType(t domain.SensorType) error {
	if !domain.SensorTypeEnabled(t) {
		return fmt.Errorf("sensor type %s is not part of this rollout yet", t)
	}
	return nil
}

type SensorInput struct {
	Name       string                   `json:"name"`
	Type       domain.SensorType        `json:"type"`
	PortKind   domain.PortKind          `json:"portKind"`
	PortIndex  int                      `json:"portIndex"`
	Unit       string                   `json:"unit"`
	Thresholds *domain.SensorThresholds `json:"thresholds,omitempty"`
	Enabled    bool                     `json:"enabled"`
	Floor      domain.FloorPoint        `json:"floor"`
}

func (i SensorInput) Validate() error {
	if strings.TrimSpace(i.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if i.PortIndex < 1 {
		return fmt.Errorf("portIndex starts at 1")
	}
	return validLimits(i.Thresholds)
}

// validLimits keeps a band the alert engine can judge: the lower limit has to sit under the
// upper one, or every reading would breach both at once.
func validLimits(t *domain.SensorThresholds) error {
	if t == nil {
		return nil
	}
	if t.Min != nil && t.Max != nil && *t.Min >= *t.Max {
		return fmt.Errorf("the lower temperature limit must be below the upper one")
	}
	if t.HumidityMin != nil && t.HumidityMax != nil && *t.HumidityMin >= *t.HumidityMax {
		return fmt.Errorf("the lower humidity limit must be below the upper one")
	}
	return nil
}

// UpdateInput is what the edit dialog and the shopfloor position editor send.
type UpdateInput struct {
	OutletID          string              `json:"outletId"`
	IP                string              `json:"ip"`
	Firmware          string              `json:"firmware"`
	Status            domain.DeviceStatus `json:"status"`
	PushIntervalSec   int                 `json:"pushIntervalSec"`
	WarrantyUntil     time.Time           `json:"warrantyUntil"`
	LastMaintenanceAt *time.Time          `json:"lastMaintenanceAt"`
	NextMaintenanceAt time.Time           `json:"nextMaintenanceAt"`
	SensorFaults      int                 `json:"sensorFaults"`
	Floor             domain.FloorPoint   `json:"floor"`
	Channels          []domain.Channel    `json:"channels"`
}

func (i UpdateInput) Validate() error {
	if i.OutletID == "" {
		return fmt.Errorf("outletId is required")
	}
	if i.Status != domain.DeviceOnline && i.Status != domain.DeviceOffline {
		return fmt.Errorf("status must be online or offline")
	}
	if i.PushIntervalSec < 30 {
		return fmt.Errorf("pushIntervalSec must be at least 30")
	}
	return nil
}

type WithSensors struct {
	Device  domain.Device   `json:"device"`
	Sensors []domain.Sensor `json:"sensors"`
}

type Service struct {
	repo Repo
	ctx  auth.Ctx
}

func NewService(db store.DB, c auth.Ctx) Service { return Service{repo: NewRepo(db, c.Tenant), ctx: c} }

func (s Service) List(ctx context.Context, o ListOpts) (httpx.Page[domain.Device], error) {
	o.Scope = s.ctx.OutletScope()
	return s.repo.List(ctx, o)
}

// Sensors answers the sensor list for the whole distribution center, narrowed to an employee's
// own outlets like every other list.
func (s Service) Sensors(ctx context.Context, o SensorOpts) ([]domain.Sensor, error) {
	if o.OutletID != "" && !s.ctx.CoversOutlet(o.OutletID) {
		return nil, httpx.Forbidden("Outlet is outside your registration")
	}
	o.Scope = s.ctx.OutletScope()
	return s.repo.ListSensors(ctx, o)
}

func (s Service) Get(ctx context.Context, id string) (WithSensors, error) {
	device, err := s.repo.Find(ctx, id)
	if err != nil {
		return WithSensors{}, err
	}
	sensors, err := s.repo.SensorsOf(ctx, id)
	if err != nil {
		return WithSensors{}, err
	}
	return WithSensors{Device: device, Sensors: sensors}, nil
}

// Create registers the unit, lays out its ports and places the chosen sensors on the floor plan.
func (s Service) Create(ctx context.Context, in CreateInput) (WithSensors, error) {
	ok, err := s.repo.OutletExists(ctx, in.OutletID)
	if err != nil {
		return WithSensors{}, err
	}
	if !ok {
		return WithSensors{}, httpx.NotFound("Outlet", in.OutletID)
	}
	deviceType, err := s.repo.DeviceType(ctx, in.DeviceTypeID)
	if err != nil {
		return WithSensors{}, err
	}

	capacity := map[domain.PortKind]int{}
	ports := []domain.DevicePort{}
	for _, p := range deviceType.Ports {
		capacity[p.Kind] = p.Count
		for i := 1; i <= p.Count; i++ {
			label := strings.ToUpper(string(p.Kind)[:1]) + string(p.Kind)[1:]
			ports = append(ports, domain.DevicePort{Index: i, Kind: p.Kind, Label: fmt.Sprintf("%s %d", label, i)})
		}
	}

	deviceID := httpx.NewID("dev")
	used := map[domain.PortKind]int{}
	sensors := []domain.Sensor{}
	for _, spec := range defaultSensors {
		if !contains(in.SensorTypes, spec.Type) {
			continue
		}
		if used[spec.PortKind] >= capacity[spec.PortKind] {
			return WithSensors{}, httpx.BadRequest("PORT_CAPACITY_EXCEEDED",
				fmt.Sprintf("%s has no free %s port for %s", deviceType.Name, spec.PortKind, spec.Name))
		}
		used[spec.PortKind]++
		sensorID := httpx.NewID("sen")
		for i := range ports {
			if ports[i].Kind == spec.PortKind && ports[i].Index == used[spec.PortKind] {
				ports[i].SensorID = &sensorID
			}
		}
		sensor := domain.Sensor{
			ID: sensorID, DeviceID: deviceID, OutletID: in.OutletID, Name: spec.Name, Type: spec.Type,
			PortKind: spec.PortKind, PortIndex: used[spec.PortKind], Unit: "state", Enabled: true,
			Floor: domain.FloorPoint{X: spec.X, Y: spec.Y},
		}
		// A measured point starts inside a sensible band; an admin narrows it per outlet.
		if spec.Type == domain.SensorTempHumidity || spec.Type == domain.SensorTemperature {
			sensor.Unit = "°C"
			sensor.Thresholds = &domain.SensorThresholds{Min: f(18), Max: f(28)}
			if spec.Type == domain.SensorTempHumidity {
				sensor.Thresholds.HumidityMin, sensor.Thresholds.HumidityMax = f(30), f(60)
			}
		}
		sensors = append(sensors, sensor)
	}

	atOutlet, err := s.repo.CountAtOutlet(ctx, in.OutletID)
	if err != nil {
		return WithSensors{}, err
	}
	now := s.ctx.Now
	device := domain.Device{
		ID: deviceID, OutletID: in.OutletID, DeviceTypeID: deviceType.ID, Model: deviceType.Model,
		Serial: orGenerated(in.Serial, string(deviceType.Model)), MAC: randomMAC(), IP: orGeneratedIP(in.IP),
		Firmware: deviceType.LatestFirmware, Status: domain.DeviceOnline, LastPushAt: now, InstalledAt: now,
		PushIntervalSec: 300, Ports: ports, Channels: []domain.Channel{"app"},
		WarrantyUntil:     now.AddDate(3, 0, 0),
		NextMaintenanceAt: now.AddDate(0, 0, deviceType.MaintenanceIntervalDays),
		UptimePct:         100,
		Floor:             domain.FloorPoint{X: 91, Y: 60},
	}
	if atOutlet > 0 {
		device.Floor.Y = 24
	}
	if err := s.repo.InsertWithSensors(ctx, device, sensors); err != nil {
		return WithSensors{}, err
	}
	return WithSensors{Device: device, Sensors: sensors}, nil
}

// Update also moves the sensors when the unit changes outlet, so the floor plan stays whole.
func (s Service) Update(ctx context.Context, id string, in UpdateInput) (WithSensors, error) {
	device, err := s.repo.Find(ctx, id)
	if err != nil {
		return WithSensors{}, err
	}
	ok, err := s.repo.OutletExists(ctx, in.OutletID)
	if err != nil {
		return WithSensors{}, err
	}
	if !ok {
		return WithSensors{}, httpx.NotFound("Outlet", in.OutletID)
	}

	device.OutletID = in.OutletID
	device.IP = in.IP
	device.Firmware = in.Firmware
	device.Status = in.Status
	device.PushIntervalSec = in.PushIntervalSec
	device.WarrantyUntil = in.WarrantyUntil
	device.LastMaintenanceAt = in.LastMaintenanceAt
	device.NextMaintenanceAt = in.NextMaintenanceAt
	device.SensorFaults = in.SensorFaults
	device.Floor = in.Floor
	if len(in.Channels) > 0 {
		device.Channels = in.Channels
	}

	updated, err := s.repo.Update(ctx, device)
	if err != nil {
		return WithSensors{}, err
	}
	if err := s.repo.MoveSensors(ctx, id, in.OutletID); err != nil {
		return WithSensors{}, err
	}
	sensors, err := s.repo.SensorsOf(ctx, id)
	if err != nil {
		return WithSensors{}, err
	}
	return WithSensors{Device: updated, Sensors: sensors}, nil
}

func (s Service) Delete(ctx context.Context, id string) error { return s.repo.Delete(ctx, id) }

// DeleteSensor frees the port it held.
func (s Service) DeleteSensor(ctx context.Context, deviceID, sensorID string) error {
	if _, err := s.repo.Find(ctx, deviceID); err != nil {
		return err
	}
	return s.repo.DeleteSensor(ctx, deviceID, sensorID)
}

// UpsertSensor checks the port before writing; the unique index is the real guard.
func (s Service) UpsertSensor(ctx context.Context, deviceID, sensorID string, in SensorInput) (domain.Sensor, error) {
	device, err := s.repo.Find(ctx, deviceID)
	if err != nil {
		return domain.Sensor{}, err
	}
	occupant, err := s.repo.PortTaken(ctx, deviceID, in.PortKind, in.PortIndex, sensorID)
	if err != nil {
		return domain.Sensor{}, err
	}
	if occupant != "" {
		return domain.Sensor{}, httpx.Conflict("PORT_ALREADY_USED",
			fmt.Sprintf("%s port %d already holds %s", in.PortKind, in.PortIndex, occupant))
	}
	// An installed door or motion sensor stays editable; only adding one, or switching a sensor
	// onto a type outside the rollout, is refused.
	current, err := s.repo.SensorType(ctx, sensorID)
	if err != nil {
		return domain.Sensor{}, err
	}
	if in.Type != current {
		if err := enabledType(in.Type); err != nil {
			return domain.Sensor{}, httpx.BadRequest("VALIDATION_FAILED", err.Error())
		}
	}
	return s.repo.UpsertSensor(ctx, domain.Sensor{
		ID: sensorID, DeviceID: deviceID, OutletID: device.OutletID, Name: in.Name, Type: in.Type,
		PortKind: in.PortKind, PortIndex: in.PortIndex, Unit: in.Unit, Thresholds: in.Thresholds,
		Enabled: in.Enabled, Floor: in.Floor,
	})
}

func contains(list []domain.SensorType, want domain.SensorType) bool {
	for _, v := range list {
		if v == want {
			return true
		}
	}
	return false
}

func f(v float64) *float64 { return &v }

func randomInt(max int64) int64 {
	n, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		return 0
	}
	return n.Int64()
}

func randomMAC() string {
	return fmt.Sprintf("00:80:A3:%02X:%02X:%02X", randomInt(256), randomInt(256), randomInt(256))
}

func orGenerated(serial, model string) string {
	if s := strings.TrimSpace(serial); s != "" {
		return s
	}
	return fmt.Sprintf("%s-F%05d-%s", strings.TrimSuffix(model, "S"), 60000+randomInt(39999), model)
}

func orGeneratedIP(ip string) string {
	if v := strings.TrimSpace(ip); v != "" {
		return v
	}
	return fmt.Sprintf("192.168.%d.%d", 10+randomInt(50), 20+randomInt(230))
}
