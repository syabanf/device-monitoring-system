// Package distributors exposes the distribution center a session belongs to. The rail shows its
// name and the setup wizard edits it.
package distributors

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const columns = `id, code, name, region, city, address, admin_user_id`

// Distributor mirrors packages/types.
type Distributor struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Region      string `json:"region"`
	City        string `json:"city"`
	Address     string `json:"address"`
	AdminUserID string `json:"adminUserId"`
	Outlets     int    `json:"outlets"`
}

type Input struct {
	Code    string `json:"code"`
	Name    string `json:"name"`
	Region  string `json:"region"`
	City    string `json:"city"`
	Address string `json:"address"`
}

func (i Input) Validate() error {
	if strings.TrimSpace(i.Name) == "" || strings.TrimSpace(i.Code) == "" {
		return fmt.Errorf("code and name are required")
	}
	return nil
}

type Service struct {
	db     store.DB
	tenant string
}

func NewService(db store.DB, c auth.Ctx) Service { return Service{db: db, tenant: c.Tenant} }

func (s Service) Get(ctx context.Context) (Distributor, error) {
	var d Distributor
	err := s.db.QueryRow(ctx, `SELECT `+columns+`,
		(SELECT count(*) FROM outlet o WHERE o.distributor_id = d.id) FROM distributor d WHERE id = $1`, s.tenant).
		Scan(&d.ID, &d.Code, &d.Name, &d.Region, &d.City, &d.Address, &d.AdminUserID, &d.Outlets)
	if errors.Is(err, pgx.ErrNoRows) {
		return Distributor{}, httpx.NotFound("Distribution center", s.tenant)
	}
	return d, err
}

func (s Service) Update(ctx context.Context, in Input) (Distributor, error) {
	tag, err := s.db.Exec(ctx, `UPDATE distributor SET code=$2, name=$3, region=$4, city=$5, address=$6 WHERE id=$1`,
		s.tenant, in.Code, in.Name, in.Region, in.City, in.Address)
	if err != nil {
		if strings.Contains(err.Error(), "distributor_code_key") {
			return Distributor{}, httpx.Conflict("CODE_TAKEN", "Another distribution center already uses "+in.Code)
		}
		return Distributor{}, err
	}
	if tag.RowsAffected() == 0 {
		return Distributor{}, httpx.NotFound("Distribution center", s.tenant)
	}
	return s.Get(ctx)
}

// Register adds the two handlers to the tenant router, whose root path is the distributor.
func Register(r chi.Router, db store.DB) {
	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		d, err := NewService(db, c).Get(req.Context())
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, d)
	})

	r.Put("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in Input
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		d, err := NewService(db, c).Update(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, d)
	})
}
