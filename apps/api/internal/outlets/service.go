package outlets

import (
	"context"
	"fmt"
	"strings"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// Input is everything a client may send. The server owns id and distributorId.
type Input struct {
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Address   string  `json:"address"`
	City      string  `json:"city"`
	Province  string  `json:"province"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	MapsURL   string  `json:"mapsUrl"`
	OpenTime  string  `json:"openTime"`
	CloseTime string  `json:"closeTime"`
	Timezone  string  `json:"timezone"`
	Phone     string  `json:"phone"`
}

func (i Input) Validate() error {
	var bad []string
	if strings.TrimSpace(i.Code) == "" {
		bad = append(bad, "code is required")
	}
	if strings.TrimSpace(i.Name) == "" {
		bad = append(bad, "name is required")
	}
	if i.Lat < -90 || i.Lat > 90 {
		bad = append(bad, "lat must be between -90 and 90")
	}
	if i.Lng < -180 || i.Lng > 180 {
		bad = append(bad, "lng must be between -180 and 180")
	}
	if !isClock(i.OpenTime) || !isClock(i.CloseTime) {
		bad = append(bad, "openTime and closeTime must look like 07:00")
	}
	if len(bad) > 0 {
		return fmt.Errorf("%s", strings.Join(bad, "; "))
	}
	return nil
}

func isClock(v string) bool {
	if len(v) != 5 || v[2] != ':' {
		return false
	}
	for i, r := range v {
		if i != 2 && (r < '0' || r > '9') {
			return false
		}
	}
	return true
}

type Service struct {
	repo Repo
	ctx  auth.Ctx
}

func NewService(db store.DB, c auth.Ctx) Service { return Service{repo: NewRepo(db, c.Tenant), ctx: c} }

func (s Service) List(ctx context.Context, o ListOpts) (httpx.Page[domain.Outlet], error) {
	return s.repo.List(ctx, o)
}

func (s Service) Get(ctx context.Context, id string) (domain.Outlet, error) {
	return s.repo.Find(ctx, id)
}

func (s Service) Create(ctx context.Context, in Input) (domain.Outlet, error) {
	if err := s.assertCodeFree(ctx, in.Code, ""); err != nil {
		return domain.Outlet{}, err
	}
	return s.repo.Insert(ctx, s.toOutlet(httpx.NewID("out"), in))
}

func (s Service) Update(ctx context.Context, id string, in Input) (domain.Outlet, error) {
	if _, err := s.repo.Find(ctx, id); err != nil {
		return domain.Outlet{}, err
	}
	if err := s.assertCodeFree(ctx, in.Code, id); err != nil {
		return domain.Outlet{}, err
	}
	return s.repo.Update(ctx, s.toOutlet(id, in))
}

func (s Service) Delete(ctx context.Context, id string) error { return s.repo.Delete(ctx, id) }

func (s Service) assertCodeFree(ctx context.Context, code, exceptID string) error {
	taken, err := s.repo.CodeTaken(ctx, code, exceptID)
	if err != nil {
		return err
	}
	if taken {
		return httpx.Conflict("OUTLET_CODE_TAKEN", "Outlet code "+code+" already exists in this distribution center")
	}
	return nil
}

// Operators paste coordinates far more often than a Maps link, so derive it when empty.
func (s Service) toOutlet(id string, in Input) domain.Outlet {
	mapsURL := strings.TrimSpace(in.MapsURL)
	if mapsURL == "" {
		mapsURL = fmt.Sprintf("https://maps.google.com/?q=%v,%v", in.Lat, in.Lng)
	}
	return domain.Outlet{
		ID: id, DistributorID: s.ctx.Tenant, Code: in.Code, Name: in.Name, Address: in.Address, City: in.City,
		Province: in.Province, Lat: in.Lat, Lng: in.Lng, MapsURL: mapsURL, OpenTime: in.OpenTime,
		CloseTime: in.CloseTime, Timezone: in.Timezone, Phone: in.Phone,
	}
}
