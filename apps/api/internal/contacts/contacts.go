// Package contacts is master data for the people an outlet's alerts are broadcast to.
package contacts

import (
	"context"
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

const columns = `c.id, c.outlet_id, c.name, c.phone, c.email, c.role, c.is_primary, c.channels`

// ContactPerson mirrors packages/types.
type ContactPerson struct {
	ID        string           `json:"id"`
	OutletID  string           `json:"outletId"`
	Name      string           `json:"name"`
	Phone     string           `json:"phone"`
	Email     *string          `json:"email"`
	Role      string           `json:"role"`
	IsPrimary bool             `json:"isPrimary"`
	Channels  []domain.Channel `json:"channels"`
}

type Input struct {
	OutletID  string           `json:"outletId"`
	Name      string           `json:"name"`
	Phone     string           `json:"phone"`
	Email     *string          `json:"email"`
	Role      string           `json:"role"`
	IsPrimary bool             `json:"isPrimary"`
	Channels  []domain.Channel `json:"channels"`
}

func (i Input) Validate() error {
	var bad []string
	if i.OutletID == "" {
		bad = append(bad, "outletId is required")
	}
	if strings.TrimSpace(i.Name) == "" {
		bad = append(bad, "name is required")
	}
	if strings.TrimSpace(i.Phone) == "" {
		bad = append(bad, "phone is required")
	}
	if len(bad) > 0 {
		return fmt.Errorf("%s", strings.Join(bad, "; "))
	}
	return nil
}

type Service struct {
	db     store.DB
	tenant string
	scope  []string
}

func NewService(db store.DB, c auth.Ctx) Service {
	return Service{db: db, tenant: c.Tenant, scope: c.OutletScope()}
}

// List joins through outlet so a contact from another tenant can never leak.
func (s Service) List(ctx context.Context, outletID string) ([]ContactPerson, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM contact_person c
		JOIN outlet o ON o.id = c.outlet_id
		WHERE o.distributor_id = $1 AND ($2 = '' OR c.outlet_id = $2)
		  AND ($3::text[] IS NULL OR c.outlet_id = ANY($3))
		ORDER BY c.is_primary DESC, c.name`, s.tenant, outletID, s.scope)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ContactPerson{}
	for rows.Next() {
		c, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s Service) Get(ctx context.Context, id string) (ContactPerson, error) {
	c, err := scan(s.db.QueryRow(ctx, `SELECT `+columns+` FROM contact_person c
		JOIN outlet o ON o.id = c.outlet_id WHERE c.id = $1 AND o.distributor_id = $2
		  AND ($3::text[] IS NULL OR c.outlet_id = ANY($3))`, id, s.tenant, s.scope))
	if errors.Is(err, pgx.ErrNoRows) {
		return ContactPerson{}, httpx.NotFound("Contact person", id)
	}
	return c, err
}

func (s Service) Create(ctx context.Context, in Input) (ContactPerson, error) {
	if err := s.assertOutlet(ctx, in.OutletID); err != nil {
		return ContactPerson{}, err
	}
	id := httpx.NewID("cp")
	if _, err := s.db.Exec(ctx, `
		INSERT INTO contact_person (id, outlet_id, name, phone, email, role, is_primary, channels)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		id, in.OutletID, in.Name, in.Phone, in.Email, in.Role, in.IsPrimary, domain.ChannelsText(channels(in.Channels))); err != nil {
		return ContactPerson{}, err
	}
	if in.IsPrimary {
		if err := s.demoteOthers(ctx, in.OutletID, id); err != nil {
			return ContactPerson{}, err
		}
	}
	return s.Get(ctx, id)
}

func (s Service) Update(ctx context.Context, id string, in Input) (ContactPerson, error) {
	existing, err := s.Get(ctx, id)
	if err != nil {
		return ContactPerson{}, err
	}
	if err := s.assertOutlet(ctx, in.OutletID); err != nil {
		return ContactPerson{}, err
	}
	if _, err := s.db.Exec(ctx, `
		UPDATE contact_person SET outlet_id=$2, name=$3, phone=$4, email=$5, role=$6, is_primary=$7, channels=$8
		WHERE id = $1`, id, in.OutletID, in.Name, in.Phone, in.Email, in.Role, in.IsPrimary, domain.ChannelsText(channels(in.Channels))); err != nil {
		return ContactPerson{}, err
	}
	if in.IsPrimary && !existing.IsPrimary {
		if err := s.demoteOthers(ctx, in.OutletID, id); err != nil {
			return ContactPerson{}, err
		}
	}
	return s.Get(ctx, id)
}

func (s Service) Delete(ctx context.Context, id string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `DELETE FROM contact_person WHERE id = $1`, id)
	return err
}

// An outlet has one primary contact; promoting a new one steps the old one down.
func (s Service) demoteOthers(ctx context.Context, outletID, keepID string) error {
	_, err := s.db.Exec(ctx, `UPDATE contact_person SET is_primary = false WHERE outlet_id = $1 AND id <> $2`, outletID, keepID)
	return err
}

func (s Service) assertOutlet(ctx context.Context, outletID string) error {
	var ok bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM outlet WHERE id = $1 AND distributor_id = $2)`,
		outletID, s.tenant).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return httpx.NotFound("Outlet", outletID)
	}
	return nil
}

func channels(v []domain.Channel) []domain.Channel {
	if len(v) == 0 {
		return []domain.Channel{"app"}
	}
	return v
}

type scanner interface{ Scan(dest ...any) error }

func scan(s scanner) (ContactPerson, error) {
	var c ContactPerson
	var ch []string
	err := s.Scan(&c.ID, &c.OutletID, &c.Name, &c.Phone, &c.Email, &c.Role, &c.IsPrimary, &ch)
	c.Channels = domain.ChannelsFrom(ch)
	return c, err
}

// Routes mounts under /distributors/{distributorId}/contact-persons.
func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		items, err := NewService(db, c).List(req.Context(), req.URL.Query().Get("outletId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[ContactPerson]{Items: items})
	})

	r.Get("/{contactId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		contact, err := NewService(db, c).Get(req.Context(), chi.URLParam(req, "contactId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, contact)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		contact, err := NewService(db, c).Create(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, contact)
	})

	r.Put("/{contactId}", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		contact, err := NewService(db, c).Update(req.Context(), chi.URLParam(req, "contactId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, contact)
	})

	r.Delete("/{contactId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		if err := NewService(db, c).Delete(req.Context(), chi.URLParam(req, "contactId")); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusNoContent, nil)
	})

	return r
}

func adminInput(req *http.Request) (auth.Ctx, Input, error) {
	c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
	if err != nil {
		return auth.Ctx{}, Input{}, err
	}
	var in Input
	if err := httpx.Decode(req, &in); err != nil {
		return auth.Ctx{}, Input{}, err
	}
	return c, in, nil
}
