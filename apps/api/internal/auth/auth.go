// Package auth issues and verifies the two kinds of session the product has: an admin signing
// in with a password, and an employee or technician exchanging the token their admin issued.
package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
)

type Kind string

const (
	KindAdmin      Kind = "admin"
	KindEmployee   Kind = "employee"
	KindTechnician Kind = "technician"
)

// Claims is the JWT payload. The tenant lives here and nowhere else.
type Claims struct {
	Kind          Kind     `json:"kind"`
	DistributorID string   `json:"distributorId"`
	OutletIDs     []string `json:"outletIds,omitempty"`
	Role          string   `json:"role,omitempty"`
	jwt.RegisteredClaims
}

// Ctx is what every service receives. Services never see http.Request.
type Ctx struct {
	Tenant    string
	UserID    string
	Kind      Kind
	OutletIDs []string
	Now       time.Time
}

// OutletScope returns the outlets a list must be narrowed to, or nil when the session sees the
// whole distribution center. Admins and technicians work across outlets; employees do not.
func (c Ctx) OutletScope() []string {
	if c.Kind != KindEmployee {
		return nil
	}
	if len(c.OutletIDs) == 0 {
		return []string{""} // an employee with no outlet sees nothing rather than everything
	}
	return c.OutletIDs
}

func (c Ctx) CoversOutlet(outletID string) bool {
	if c.Kind != KindEmployee {
		return true
	}
	for _, id := range c.OutletIDs {
		if id == outletID {
			return true
		}
	}
	return false
}

type Signer struct {
	secret []byte
}

func NewSigner(secret []byte) Signer { return Signer{secret: secret} }

func (s Signer) Sign(c Claims, ttl time.Duration, now time.Time) (string, error) {
	c.ExpiresAt = jwt.NewNumericDate(now.Add(ttl))
	c.IssuedAt = jwt.NewNumericDate(now)
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.secret)
}

type ctxKey struct{}

// Middleware verifies the bearer token and puts the request context on the request.
func (s Signer) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if raw == "" || raw == r.Header.Get("Authorization") {
			httpx.Fail(w, r, httpx.Unauthorized("Missing bearer token"))
			return
		}
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(raw, claims, func(*jwt.Token) (any, error) { return s.secret, nil },
			jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
		if err != nil || !token.Valid || claims.Subject == "" || claims.DistributorID == "" {
			httpx.Fail(w, r, httpx.Unauthorized("Token is invalid or expired"))
			return
		}
		ctx := Ctx{Tenant: claims.DistributorID, UserID: claims.Subject, Kind: claims.Kind, OutletIDs: claims.OutletIDs, Now: time.Now().UTC()}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, ctx)))
	})
}

// From reads the context an authenticated route is guaranteed to have.
func From(r *http.Request) (Ctx, error) {
	c, ok := r.Context().Value(ctxKey{}).(Ctx)
	if !ok {
		return Ctx{}, httpx.Unauthorized("Route is missing the auth middleware")
	}
	return c, nil
}

// Tenant checks the URL tenant against the token. The token always wins.
func Tenant(r *http.Request, distributorID string) (Ctx, error) {
	c, err := From(r)
	if err != nil {
		return Ctx{}, err
	}
	if c.Tenant != distributorID {
		return Ctx{}, httpx.Forbidden("Token belongs to a different distribution center")
	}
	return c, nil
}

// Admin narrows a route to the dashboard.
func Admin(r *http.Request, distributorID string) (Ctx, error) {
	c, err := Tenant(r, distributorID)
	if err != nil {
		return Ctx{}, err
	}
	if c.Kind != KindAdmin {
		return Ctx{}, httpx.Forbidden("Admin only")
	}
	return c, nil
}
