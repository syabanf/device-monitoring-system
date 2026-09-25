// Package devicetypes is master data for the AKCP models approved for installation.
// Models are shared across distribution centers, so only an admin may change them.
package devicetypes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const columns = `id, model, name, vendor, ports, built_in_sensors, description, price_idr, latest_firmware, maintenance_interval_days`

type Input struct {
	Model                   domain.DeviceModel      `json:"model"`
	Name                    string                  `json:"name"`
	Vendor                  string                  `json:"vendor"`
	Ports                   []domain.DeviceTypePort `json:"ports"`
	BuiltInSensors          []domain.SensorType     `json:"builtInSensors"`
	Description             string                  `json:"description"`
	PriceIDR                int64                   `json:"priceIdr"`
	LatestFirmware          string                  `json:"latestFirmware"`
	MaintenanceIntervalDays int                     `json:"maintenanceIntervalDays"`
}

func (i Input) Validate() error {
	var bad []string
	if strings.TrimSpace(string(i.Model)) == "" {
		bad = append(bad, "model is required")
	}
	if strings.TrimSpace(i.Name) == "" {
		bad = append(bad, "name is required")
	}
	if len(i.Ports) == 0 {
		bad = append(bad, "at least one port is required")
	}
	if i.MaintenanceIntervalDays < 1 {
		bad = append(bad, "maintenanceIntervalDays must be positive")
	}
	if len(bad) > 0 {
		return fmt.Errorf("%s", strings.Join(bad, "; "))
	}
	return nil
}

type Service struct{ db store.DB }

func NewService(db store.DB) Service { return Service{db: db} }

func (s Service) List(ctx context.Context) ([]domain.DeviceType, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM device_type ORDER BY price_idr`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.DeviceType{}
	for rows.Next() {
		t, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s Service) Get(ctx context.Context, id string) (domain.DeviceType, error) {
	t, err := scan(s.db.QueryRow(ctx, `SELECT `+columns+` FROM device_type WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DeviceType{}, httpx.NotFound("Device type", id)
	}
	return t, err
}

func (s Service) Create(ctx context.Context, in Input) (domain.DeviceType, error) {
	return s.write(ctx, httpx.NewID("dt"), in, true)
}

func (s Service) Update(ctx context.Context, id string, in Input) (domain.DeviceType, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return domain.DeviceType{}, err
	}
	return s.write(ctx, id, in, false)
}

// Delete refuses while units of this model are installed, so the fleet keeps its model data.
func (s Service) Delete(ctx context.Context, id string) error {
	var installed int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM device WHERE device_type_id = $1`, id).Scan(&installed); err != nil {
		return err
	}
	if installed > 0 {
		return httpx.Conflict("DEVICE_TYPE_IN_USE", fmt.Sprintf("%d device(s) still use this model", installed))
	}
	tag, err := s.db.Exec(ctx, `DELETE FROM device_type WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("Device type", id)
	}
	return nil
}

func (s Service) write(ctx context.Context, id string, in Input, insert bool) (domain.DeviceType, error) {
	ports, err := json.Marshal(in.Ports)
	if err != nil {
		return domain.DeviceType{}, err
	}
	sensors := domain.SensorTypesText(in.BuiltInSensors)
	query := `UPDATE device_type SET model=$2, name=$3, vendor=$4, ports=$5, built_in_sensors=$6, description=$7,
		price_idr=$8, latest_firmware=$9, maintenance_interval_days=$10 WHERE id=$1 RETURNING ` + columns
	if insert {
		query = `INSERT INTO device_type (id, model, name, vendor, ports, built_in_sensors, description, price_idr,
			latest_firmware, maintenance_interval_days) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ` + columns
	}
	t, err := scan(s.db.QueryRow(ctx, query, id, in.Model, in.Name, in.Vendor, ports, sensors, in.Description,
		in.PriceIDR, in.LatestFirmware, in.MaintenanceIntervalDays))
	if err != nil && strings.Contains(err.Error(), "device_type_model_key") {
		return domain.DeviceType{}, httpx.Conflict("MODEL_TAKEN", "Another device type already uses model "+string(in.Model))
	}
	return t, err
}

type scanner interface{ Scan(dest ...any) error }

func scan(s scanner) (domain.DeviceType, error) {
	var t domain.DeviceType
	var (
		ports   []byte
		sensors []string
	)
	if err := s.Scan(&t.ID, &t.Model, &t.Name, &t.Vendor, &ports, &sensors, &t.Description,
		&t.PriceIDR, &t.LatestFirmware, &t.MaintenanceIntervalDays); err != nil {
		return t, err
	}
	t.BuiltInSensors = domain.SensorTypesFrom(sensors)
	return t, json.Unmarshal(ports, &t.Ports)
}

// Routes mounts at /device-types. Any session may read; only an admin writes.
func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()
	svc := NewService(db)

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		if _, err := auth.From(req); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		items, err := svc.List(req.Context())
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[domain.DeviceType]{Items: items})
	})

	r.Get("/{deviceTypeId}", func(w http.ResponseWriter, req *http.Request) {
		if _, err := auth.From(req); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		t, err := svc.Get(req.Context(), chi.URLParam(req, "deviceTypeId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, t)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		t, err := svc.Create(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, t)
	})

	r.Put("/{deviceTypeId}", func(w http.ResponseWriter, req *http.Request) {
		in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		t, err := svc.Update(req.Context(), chi.URLParam(req, "deviceTypeId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, t)
	})

	r.Delete("/{deviceTypeId}", func(w http.ResponseWriter, req *http.Request) {
		if err := requireAdmin(req); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		if err := svc.Delete(req.Context(), chi.URLParam(req, "deviceTypeId")); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusNoContent, nil)
	})

	return r
}

func requireAdmin(req *http.Request) error {
	c, err := auth.From(req)
	if err != nil {
		return err
	}
	if c.Kind != auth.KindAdmin {
		return httpx.Forbidden("Admin only")
	}
	return nil
}

func adminInput(req *http.Request) (Input, error) {
	if err := requireAdmin(req); err != nil {
		return Input{}, err
	}
	var in Input
	if err := httpx.Decode(req, &in); err != nil {
		return Input{}, err
	}
	return in, nil
}
