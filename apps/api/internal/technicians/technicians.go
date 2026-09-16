// Package technicians is master data for the maintenance crew of a distribution center.
package technicians

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const columns = `id, distributor_id, name, phone, specialty, avatar_color, email, registration_token`

// Technician mirrors packages/types.
type Technician struct {
	ID                string `json:"id"`
	DistributorID     string `json:"distributorId"`
	Name              string `json:"name"`
	Phone             string `json:"phone"`
	Specialty         string `json:"specialty"`
	AvatarColor       string `json:"avatarColor"`
	Email             string `json:"email"`
	RegistrationToken string `json:"registrationToken"`
}

type Input struct {
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Specialty   string `json:"specialty"`
	AvatarColor string `json:"avatarColor"`
	Email       string `json:"email"`
}

func (i Input) Validate() error {
	var bad []string
	if strings.TrimSpace(i.Name) == "" {
		bad = append(bad, "name is required")
	}
	if !strings.Contains(i.Email, "@") {
		bad = append(bad, "email must be an address")
	}
	if strings.TrimSpace(i.Phone) == "" {
		bad = append(bad, "phone is required")
	}
	if len(bad) > 0 {
		return fmt.Errorf("%s", strings.Join(bad, "; "))
	}
	return nil
}

// Token is the 10 digit code a technician types into the mobile app.
func Token() string {
	n, err := rand.Int(rand.Reader, big.NewInt(10_000_000_000))
	if err != nil {
		return "0000000000"
	}
	return fmt.Sprintf("%010d", n.Int64())
}

type Service struct {
	db     store.DB
	tenant string
}

func NewService(db store.DB, c auth.Ctx) Service { return Service{db: db, tenant: c.Tenant} }

func (s Service) List(ctx context.Context) ([]Technician, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM technician WHERE distributor_id = $1 ORDER BY name`, s.tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Technician{}
	for rows.Next() {
		t, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s Service) Get(ctx context.Context, id string) (Technician, error) {
	t, err := scan(s.db.QueryRow(ctx, `SELECT `+columns+` FROM technician WHERE id = $1 AND distributor_id = $2`, id, s.tenant))
	if errors.Is(err, pgx.ErrNoRows) {
		return Technician{}, httpx.NotFound("Technician", id)
	}
	return t, err
}

func (s Service) Create(ctx context.Context, in Input) (Technician, error) {
	t, err := scan(s.db.QueryRow(ctx, `
		INSERT INTO technician (id, distributor_id, name, phone, specialty, avatar_color, email, registration_token)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING `+columns,
		httpx.NewID("tech"), s.tenant, in.Name, in.Phone, in.Specialty, orDefault(in.AvatarColor, "#101112"),
		strings.ToLower(in.Email), Token()))
	return t, emailConflict(err, in.Email)
}

func (s Service) Update(ctx context.Context, id string, in Input) (Technician, error) {
	t, err := scan(s.db.QueryRow(ctx, `
		UPDATE technician SET name=$3, phone=$4, specialty=$5, avatar_color=$6, email=$7
		WHERE id = $1 AND distributor_id = $2 RETURNING `+columns,
		id, s.tenant, in.Name, in.Phone, in.Specialty, orDefault(in.AvatarColor, "#101112"), strings.ToLower(in.Email)))
	if errors.Is(err, pgx.ErrNoRows) {
		return Technician{}, httpx.NotFound("Technician", id)
	}
	return t, emailConflict(err, in.Email)
}

// RotateToken invalidates the old code, which is how an admin revokes a lost phone.
func (s Service) RotateToken(ctx context.Context, id string) (Technician, error) {
	t, err := scan(s.db.QueryRow(ctx, `UPDATE technician SET registration_token = $3
		WHERE id = $1 AND distributor_id = $2 RETURNING `+columns, id, s.tenant, Token()))
	if errors.Is(err, pgx.ErrNoRows) {
		return Technician{}, httpx.NotFound("Technician", id)
	}
	return t, err
}

// Delete leaves their finished tickets in place; the foreign key sets technician_id to null.
func (s Service) Delete(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM technician WHERE id = $1 AND distributor_id = $2`, id, s.tenant)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("Technician", id)
	}
	return nil
}

func emailConflict(err error, email string) error {
	if err != nil && strings.Contains(err.Error(), "technician_email_key") {
		return httpx.Conflict("EMAIL_TAKEN", "Another technician already uses "+email)
	}
	return err
}

func orDefault(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

type scanner interface{ Scan(dest ...any) error }

func scan(s scanner) (Technician, error) {
	var t Technician
	err := s.Scan(&t.ID, &t.DistributorID, &t.Name, &t.Phone, &t.Specialty, &t.AvatarColor, &t.Email, &t.RegistrationToken)
	return t, err
}

// Routes mounts under /distributors/{distributorId}/technicians.
func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		items, err := NewService(db, c).List(req.Context())
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[Technician]{Items: items})
	})

	r.Get("/{technicianId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		t, err := NewService(db, c).Get(req.Context(), chi.URLParam(req, "technicianId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, t)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		t, err := NewService(db, c).Create(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, t)
	})

	r.Put("/{technicianId}", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		t, err := NewService(db, c).Update(req.Context(), chi.URLParam(req, "technicianId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, t)
	})

	r.Post("/{technicianId}/token", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		t, err := NewService(db, c).RotateToken(req.Context(), chi.URLParam(req, "technicianId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, t)
	})

	r.Delete("/{technicianId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		if err := NewService(db, c).Delete(req.Context(), chi.URLParam(req, "technicianId")); err != nil {
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
