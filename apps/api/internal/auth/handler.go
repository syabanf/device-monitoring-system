package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

type adminLogin struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (i adminLogin) Validate() error {
	if !strings.Contains(i.Email, "@") || len(i.Password) < 6 {
		return errors.New("email must be an address and password at least 6 characters")
	}
	return nil
}

type tokenLogin struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

func (i tokenLogin) Validate() error {
	if !strings.Contains(i.Email, "@") || len(i.Token) < 6 {
		return errors.New("email must be an address and token at least 6 characters")
	}
	return nil
}

type session struct {
	Sub           string   `json:"sub"`
	Kind          Kind     `json:"kind"`
	DistributorID string   `json:"distributorId"`
	OutletIDs     []string `json:"outletIds,omitempty"`
	Role          string   `json:"role,omitempty"`
	Name          string   `json:"name"`
	Email         string   `json:"email"`
}

type loginResponse struct {
	AccessToken  string  `json:"accessToken"`
	ExpiresInSec int     `json:"expiresInSec"`
	Session      session `json:"session"`
}

// Routes mounts /auth. Admins sign in with a password; employees and technicians exchange the
// registration token their admin issued.
func Routes(db store.DB, signer Signer, accessTTL, deviceTTL time.Duration) chi.Router {
	r := chi.NewRouter()

	r.Post("/admin/login", func(w http.ResponseWriter, req *http.Request) {
		var in adminLogin
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		s, err := adminSession(req.Context(), db, in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		issue(w, req, signer, s, accessTTL)
	})

	r.Post("/token/login", func(w http.ResponseWriter, req *http.Request) {
		var in tokenLogin
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		s, err := tokenSession(req.Context(), db, in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		issue(w, req, signer, s, deviceTTL)
	})

	return r
}

func issue(w http.ResponseWriter, req *http.Request, signer Signer, s session, ttl time.Duration) {
	claims := Claims{Kind: s.Kind, DistributorID: s.DistributorID, OutletIDs: s.OutletIDs, Role: s.Role}
	claims.Subject = s.Sub
	token, err := signer.Sign(claims, ttl, time.Now().UTC())
	if err != nil {
		httpx.Fail(w, req, err)
		return
	}
	httpx.JSON(w, http.StatusOK, loginResponse{AccessToken: token, ExpiresInSec: int(ttl.Seconds()), Session: s})
}

func adminSession(ctx context.Context, db store.DB, in adminLogin) (session, error) {
	var s session
	var hash string
	err := db.QueryRow(ctx, `SELECT id, distributor_id, name, email, role, password_hash FROM admin_user WHERE email = $1`,
		strings.ToLower(in.Email)).Scan(&s.Sub, &s.DistributorID, &s.Name, &s.Email, &s.Role, &hash)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !VerifyPassword(in.Password, hash)) {
		return session{}, httpx.Unauthorized("Email or password is wrong")
	}
	if err != nil {
		return session{}, err
	}
	s.Kind = KindAdmin
	return s, nil
}

func tokenSession(ctx context.Context, db store.DB, in tokenLogin) (session, error) {
	email := strings.ToLower(in.Email)

	var (
		s        session
		stored   *string
		status   string
		outletID []string
	)
	err := db.QueryRow(ctx, `
		SELECT e.id, e.distributor_id, e.name, e.email, e.role::text, e.registration_token, e.registration_status::text,
		       COALESCE(ARRAY(SELECT eo.outlet_id FROM employee_outlet eo WHERE eo.employee_id = e.id), '{}')
		FROM employee e WHERE e.email = $1`, email).
		Scan(&s.Sub, &s.DistributorID, &s.Name, &s.Email, &s.Role, &stored, &status, &outletID)
	if err == nil {
		if stored == nil || *stored != in.Token {
			return session{}, httpx.Unauthorized("Token does not match this account")
		}
		if status != "approved" {
			return session{}, httpx.Unauthorized("Registration is still awaiting admin approval")
		}
		s.Kind, s.OutletIDs = KindEmployee, outletID
		return s, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return session{}, err
	}

	var technicianToken string
	err = db.QueryRow(ctx, `SELECT id, distributor_id, name, email, registration_token FROM technician WHERE email = $1`, email).
		Scan(&s.Sub, &s.DistributorID, &s.Name, &s.Email, &technicianToken)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && technicianToken != in.Token) {
		return session{}, httpx.Unauthorized("Email or token is wrong")
	}
	if err != nil {
		return session{}, err
	}
	s.Kind, s.Role = KindTechnician, "technician"
	return s, nil
}
