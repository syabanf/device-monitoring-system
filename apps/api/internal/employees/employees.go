// Package employees is master data for outlet staff, including the registration token they
// type into the mobile app and the approval an admin gives before that token works.
package employees

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/technicians"
)

const columns = `e.id, e.distributor_id, e.primary_outlet_id, e.name, e.phone, e.email, e.role,
	e.registration_token, e.registration_status, e.registered_at, e.approved_at, e.avatar_color,
	COALESCE(ARRAY(SELECT eo.outlet_id FROM employee_outlet eo WHERE eo.employee_id = e.id ORDER BY eo.outlet_id), '{}')`

// Employee mirrors packages/types.
type Employee struct {
	ID                 string     `json:"id"`
	DistributorID      string     `json:"distributorId"`
	PrimaryOutletID    string     `json:"primaryOutletId"`
	Name               string     `json:"name"`
	Phone              string     `json:"phone"`
	Email              string     `json:"email"`
	Role               string     `json:"role"`
	RegistrationToken  *string    `json:"registrationToken"`
	RegistrationStatus string     `json:"registrationStatus"`
	RegisteredAt       *time.Time `json:"registeredAt"`
	ApprovedAt         *time.Time `json:"approvedAt"`
	AvatarColor        string     `json:"avatarColor"`
	OutletIDs          []string   `json:"outletIds"`
}

type Input struct {
	Name            string   `json:"name"`
	Phone           string   `json:"phone"`
	Email           string   `json:"email"`
	Role            string   `json:"role"`
	OutletIDs       []string `json:"outletIds"`
	PrimaryOutletID string   `json:"primaryOutletId"`
	AvatarColor     string   `json:"avatarColor"`
}

var roles = map[string]bool{"store_manager": true, "assistant_manager": true, "cashier": true, "staff": true}

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
	if !roles[i.Role] {
		bad = append(bad, "role must be store_manager, assistant_manager, cashier or staff")
	}
	if len(i.OutletIDs) == 0 {
		bad = append(bad, "at least one outlet is required")
	}
	if len(bad) > 0 {
		return fmt.Errorf("%s", strings.Join(bad, "; "))
	}
	return nil
}

type Service struct {
	db     store.DB
	tenant string
}

func NewService(db store.DB, c auth.Ctx) Service { return Service{db: db, tenant: c.Tenant} }

type ListOpts struct {
	OutletID string
	Status   string
}

func (s Service) List(ctx context.Context, o ListOpts) ([]Employee, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM employee e
		WHERE e.distributor_id = $1
		  AND ($2 = '' OR e.registration_status::text = $2)
		  AND ($3 = '' OR EXISTS (SELECT 1 FROM employee_outlet eo WHERE eo.employee_id = e.id AND eo.outlet_id = $3))
		ORDER BY e.name`, s.tenant, o.Status, o.OutletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Employee{}
	for rows.Next() {
		e, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s Service) Get(ctx context.Context, id string) (Employee, error) {
	e, err := scan(s.db.QueryRow(ctx, `SELECT `+columns+` FROM employee e WHERE e.id = $1 AND e.distributor_id = $2`, id, s.tenant))
	if errors.Is(err, pgx.ErrNoRows) {
		return Employee{}, httpx.NotFound("Employee", id)
	}
	return e, err
}

// Create issues a token straight away; the employee still cannot sign in until an admin approves.
func (s Service) Create(ctx context.Context, in Input, now time.Time) (Employee, error) {
	if err := s.assertOutlets(ctx, in.OutletIDs); err != nil {
		return Employee{}, err
	}
	id := httpx.NewID("emp")
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Employee{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		INSERT INTO employee (id, distributor_id, primary_outlet_id, name, phone, email, role, registration_token,
			registration_status, registered_at, avatar_color)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)`,
		id, s.tenant, primaryOf(in), in.Name, in.Phone, strings.ToLower(in.Email), in.Role,
		technicians.Token(), now, orDefault(in.AvatarColor, "#101112")); err != nil {
		if strings.Contains(err.Error(), "employee_email_key") {
			return Employee{}, httpx.Conflict("EMAIL_TAKEN", "Another employee already uses "+in.Email)
		}
		return Employee{}, err
	}
	if err := replaceOutlets(ctx, tx, id, in.OutletIDs); err != nil {
		return Employee{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Employee{}, err
	}
	return s.Get(ctx, id)
}

func (s Service) Update(ctx context.Context, id string, in Input) (Employee, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return Employee{}, err
	}
	if err := s.assertOutlets(ctx, in.OutletIDs); err != nil {
		return Employee{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Employee{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE employee SET primary_outlet_id=$3, name=$4, phone=$5, email=$6, role=$7, avatar_color=$8
		WHERE id = $1 AND distributor_id = $2`,
		id, s.tenant, primaryOf(in), in.Name, in.Phone, strings.ToLower(in.Email), in.Role,
		orDefault(in.AvatarColor, "#101112")); err != nil {
		return Employee{}, err
	}
	if err := replaceOutlets(ctx, tx, id, in.OutletIDs); err != nil {
		return Employee{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Employee{}, err
	}
	return s.Get(ctx, id)
}

// Approve is what makes the token usable on the phone.
func (s Service) Approve(ctx context.Context, id string, now time.Time) (Employee, error) {
	return s.exec(ctx, id, `UPDATE employee SET registration_status = 'approved', approved_at = $3
		WHERE id = $1 AND distributor_id = $2`, now)
}

// IssueToken rotates the code, which is how an admin recovers a lost or shared phone.
func (s Service) IssueToken(ctx context.Context, id string) (Employee, error) {
	return s.exec(ctx, id, `UPDATE employee SET registration_token = $3 WHERE id = $1 AND distributor_id = $2`, technicians.Token())
}

// Revoke drops the token and sends the account back to pending.
func (s Service) Revoke(ctx context.Context, id string) (Employee, error) {
	return s.exec(ctx, id, `UPDATE employee SET registration_token = NULL, registration_status = 'pending', approved_at = NULL
		WHERE id = $1 AND distributor_id = $2`)
}

func (s Service) Delete(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM employee WHERE id = $1 AND distributor_id = $2`, id, s.tenant)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("Employee", id)
	}
	return nil
}

func (s Service) exec(ctx context.Context, id, query string, args ...any) (Employee, error) {
	tag, err := s.db.Exec(ctx, query, append([]any{id, s.tenant}, args...)...)
	if err != nil {
		return Employee{}, err
	}
	if tag.RowsAffected() == 0 {
		return Employee{}, httpx.NotFound("Employee", id)
	}
	return s.Get(ctx, id)
}

func (s Service) assertOutlets(ctx context.Context, ids []string) error {
	var found int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM outlet WHERE distributor_id = $1 AND id = ANY($2)`,
		s.tenant, ids).Scan(&found); err != nil {
		return err
	}
	if found != len(ids) {
		return httpx.BadRequest("UNKNOWN_OUTLET", "One or more outlets do not belong to this distribution center")
	}
	return nil
}

func replaceOutlets(ctx context.Context, tx pgx.Tx, employeeID string, outletIDs []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM employee_outlet WHERE employee_id = $1`, employeeID); err != nil {
		return err
	}
	for _, outletID := range outletIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO employee_outlet (employee_id, outlet_id) VALUES ($1, $2)`, employeeID, outletID); err != nil {
			return err
		}
	}
	return nil
}

func primaryOf(in Input) string {
	for _, id := range in.OutletIDs {
		if id == in.PrimaryOutletID {
			return id
		}
	}
	return in.OutletIDs[0]
}

func orDefault(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

type scanner interface{ Scan(dest ...any) error }

func scan(s scanner) (Employee, error) {
	var e Employee
	err := s.Scan(&e.ID, &e.DistributorID, &e.PrimaryOutletID, &e.Name, &e.Phone, &e.Email, &e.Role,
		&e.RegistrationToken, &e.RegistrationStatus, &e.RegisteredAt, &e.ApprovedAt, &e.AvatarColor, &e.OutletIDs)
	return e, err
}

// Routes mounts under /distributors/{distributorId}/employees.
func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		items, err := NewService(db, c).List(req.Context(), ListOpts{
			OutletID: req.URL.Query().Get("outletId"),
			Status:   req.URL.Query().Get("status"),
		})
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, httpx.Page[Employee]{Items: items})
	})

	r.Get("/{employeeId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		e, err := NewService(db, c).Get(req.Context(), chi.URLParam(req, "employeeId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, e)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		e, err := NewService(db, c).Create(req.Context(), in, c.Now)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, e)
	})

	r.Put("/{employeeId}", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		e, err := NewService(db, c).Update(req.Context(), chi.URLParam(req, "employeeId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, e)
	})

	r.Post("/{employeeId}/approve", action(db, func(s Service, ctx context.Context, id string, now time.Time) (Employee, error) {
		return s.Approve(ctx, id, now)
	}))
	r.Post("/{employeeId}/token", action(db, func(s Service, ctx context.Context, id string, _ time.Time) (Employee, error) {
		return s.IssueToken(ctx, id)
	}))
	r.Post("/{employeeId}/revoke", action(db, func(s Service, ctx context.Context, id string, _ time.Time) (Employee, error) {
		return s.Revoke(ctx, id)
	}))

	r.Delete("/{employeeId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		if err := NewService(db, c).Delete(req.Context(), chi.URLParam(req, "employeeId")); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusNoContent, nil)
	})

	return r
}

// action wraps the three admin-only state changes that share one shape.
func action(db store.DB, run func(Service, context.Context, string, time.Time) (Employee, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		e, err := run(NewService(db, c), req.Context(), chi.URLParam(req, "employeeId"), c.Now)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, e)
	}
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
