package alerts

import (
	"context"
	"fmt"
	"strings"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/uploads"
)

// next is the lifecycle the dashboard tabs show.
var next = map[domain.AlertStatus][]domain.AlertStatus{
	domain.AlertUnacknowledged: {domain.AlertAcknowledged, domain.AlertResponding, domain.AlertResolved},
	domain.AlertAcknowledged:   {domain.AlertResponding, domain.AlertResolved},
	domain.AlertResponding:     {domain.AlertResolved},
	domain.AlertResolved:       {domain.AlertVerified},
	domain.AlertVerified:       {},
}

// CanTransition reports whether the lifecycle allows a move. Exported so the rule is testable
// without a database.
func CanTransition(from, to domain.AlertStatus) bool {
	for _, allowed := range next[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

type RespondInput struct {
	Notes     string   `json:"notes"`
	PhotoURLs []string `json:"photoUrls"`
}

func (i RespondInput) Validate() error {
	if strings.TrimSpace(i.Notes) == "" {
		return fmt.Errorf("notes is required")
	}
	return uploads.Validate(i.PhotoURLs)
}

type StatusInput struct {
	Status     domain.AlertStatus `json:"status"`
	ClearValue *string            `json:"clearValue,omitempty"`
}

func (i StatusInput) Validate() error {
	if _, ok := next[i.Status]; !ok {
		return fmt.Errorf("status must be one of UNACKNOWLEDGED, ACKNOWLEDGED, RESPONDING, RESOLVED, VERIFIED")
	}
	return nil
}

type Service struct {
	repo  Repo
	ctx   auth.Ctx
	db    store.DB
	queue jobs.Queue
}

func NewService(db store.DB, c auth.Ctx, q jobs.Queue) Service {
	return Service{repo: NewRepo(db, c.Tenant), ctx: c, db: db, queue: q}
}

// List keeps employees inside their own outlets whatever the query asks for.
func (s Service) List(ctx context.Context, o ListOpts) (httpx.Page[domain.Alert], error) {
	if s.ctx.Kind == auth.KindEmployee {
		if o.OutletID != "" && !s.ctx.CoversOutlet(o.OutletID) {
			return httpx.Page[domain.Alert]{}, httpx.Forbidden("Outlet is outside your registration")
		}
	}
	o.Scope = s.ctx.OutletScope()
	return s.repo.List(ctx, o)
}

func (s Service) Get(ctx context.Context, id int64) (domain.Alert, error) {
	alert, err := s.repo.Find(ctx, id)
	if err != nil {
		return domain.Alert{}, err
	}
	if !s.ctx.CoversOutlet(alert.OutletID) {
		return domain.Alert{}, httpx.Forbidden("Alert belongs to another outlet")
	}
	return alert, nil
}

func (s Service) Respond(ctx context.Context, id int64, in RespondInput) (domain.Alert, error) {
	if s.ctx.Kind != auth.KindEmployee {
		return domain.Alert{}, httpx.Forbidden("Only outlet employees respond to alerts")
	}
	alert, err := s.Get(ctx, id)
	if err != nil {
		return domain.Alert{}, err
	}
	if alert.Response != nil {
		return domain.Alert{}, httpx.Conflict("ALREADY_RESPONDED", "Another employee already responded to this alert")
	}
	claimed, err := s.repo.Claim(ctx, id, s.ctx.UserID, s.ctx.Now)
	if err != nil {
		return domain.Alert{}, err
	}
	if !claimed {
		return domain.Alert{}, httpx.Conflict("ALREADY_RESPONDED", "Another employee claimed this alert first")
	}
	photos := in.PhotoURLs
	if photos == nil {
		photos = []string{}
	}
	duration := int(s.ctx.Now.Sub(alert.TriggerTime).Seconds())
	if duration < 0 {
		duration = 0
	}
	if err := s.repo.SaveResponse(ctx, id, s.ctx.UserID, in.Notes, photos, s.ctx.Now, duration); err != nil {
		return domain.Alert{}, err
	}
	if err := jobs.Emit(ctx, s.db, s.queue, jobs.AlertResponded, jobs.Payload{"alertId": id, "outletId": alert.OutletID, "employeeId": s.ctx.UserID}); err != nil {
		return domain.Alert{}, err
	}
	return s.repo.Find(ctx, id)
}

func (s Service) SetStatus(ctx context.Context, id int64, in StatusInput) (domain.Alert, error) {
	alert, err := s.Get(ctx, id)
	if err != nil {
		return domain.Alert{}, err
	}
	if alert.Status == in.Status {
		return alert, nil
	}
	if !CanTransition(alert.Status, in.Status) {
		return domain.Alert{}, httpx.Conflict("INVALID_TRANSITION",
			fmt.Sprintf("Cannot move an alert from %s to %s", alert.Status, in.Status))
	}
	if in.Status == domain.AlertVerified && s.ctx.Kind != auth.KindAdmin {
		return domain.Alert{}, httpx.Forbidden("Only an admin verifies a resolved alert")
	}
	if err := s.repo.SetStatus(ctx, id, in.Status, s.ctx.Now, in.ClearValue); err != nil {
		return domain.Alert{}, err
	}
	if in.Status == domain.AlertResolved {
		if err := jobs.Emit(ctx, s.db, s.queue, jobs.AlertCleared, jobs.Payload{"alertId": id, "outletId": alert.OutletID}); err != nil {
			return domain.Alert{}, err
		}
	}
	return s.repo.Find(ctx, id)
}
