// Package tickets covers the maintenance work list: create, assign, schedule and complete.
package tickets

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
	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

var next = map[domain.TicketStatus][]domain.TicketStatus{
	domain.TicketOpen:       {domain.TicketScheduled, domain.TicketInProgress, domain.TicketDone},
	domain.TicketScheduled:  {domain.TicketInProgress, domain.TicketOpen, domain.TicketDone},
	domain.TicketInProgress: {domain.TicketDone, domain.TicketScheduled},
	domain.TicketDone:       {},
}

// CanTransition reports whether the work flow allows a move, without needing a database.
func CanTransition(from, to domain.TicketStatus) bool {
	for _, allowed := range next[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

const columns = `id, distributor_id, outlet_id, device_id, sensor_id, type, priority, status, title, description,
	technician_id, created_at, scheduled_at, completed_at, parts_used, notes, photo_urls`

type CreateInput struct {
	OutletID     string                 `json:"outletId"`
	DeviceID     string                 `json:"deviceId"`
	SensorID     *string                `json:"sensorId"`
	Type         domain.MaintenanceKind `json:"type"`
	Priority     domain.TicketPriority  `json:"priority"`
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	TechnicianID *string                `json:"technicianId"`
	ScheduledAt  *time.Time             `json:"scheduledAt"`
}

func (i CreateInput) Validate() error {
	if i.OutletID == "" || i.DeviceID == "" {
		return fmt.Errorf("outletId and deviceId are required")
	}
	if strings.TrimSpace(i.Title) == "" {
		return fmt.Errorf("title is required")
	}
	return nil
}

type PatchInput struct {
	Status       *domain.TicketStatus   `json:"status,omitempty"`
	Priority     *domain.TicketPriority `json:"priority,omitempty"`
	TechnicianID *string                `json:"technicianId,omitempty"`
	ScheduledAt  *time.Time             `json:"scheduledAt,omitempty"`
	Notes        *string                `json:"notes,omitempty"`
	PartsUsed    []string               `json:"partsUsed,omitempty"`
	PhotoURLs    []string               `json:"photoUrls,omitempty"`
}

func (i PatchInput) Validate() error {
	if i.Status != nil {
		if _, ok := next[*i.Status]; !ok {
			return fmt.Errorf("status must be one of OPEN, SCHEDULED, IN_PROGRESS, DONE")
		}
	}
	return nil
}

type Service struct {
	db     store.DB
	tenant string
	ctx    auth.Ctx
	queue  jobs.Queue
}

func NewService(db store.DB, c auth.Ctx, q jobs.Queue) Service {
	return Service{db: db, tenant: c.Tenant, ctx: c, queue: q}
}

type ListOpts struct {
	Cursor       string
	Limit        int
	OutletID     string
	Status       string
	TechnicianID string
}

func (s Service) List(ctx context.Context, o ListOpts) (httpx.Page[domain.Ticket], error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM ticket
		WHERE distributor_id = $1
		  AND ($2 = '' OR outlet_id = $2)
		  AND ($3 = '' OR status::text = $3)
		  AND ($4 = '' OR technician_id = $4)
		  AND ($5 = '' OR id < $5)
		ORDER BY id DESC
		LIMIT $6`, s.tenant, o.OutletID, o.Status, o.TechnicianID, httpx.DecodeCursor(o.Cursor), o.Limit+1)
	if err != nil {
		return httpx.Page[domain.Ticket]{}, err
	}
	defer rows.Close()

	page := httpx.Page[domain.Ticket]{Items: []domain.Ticket{}}
	for rows.Next() {
		t, err := scan(rows)
		if err != nil {
			return page, err
		}
		page.Items = append(page.Items, t)
	}
	if err := rows.Err(); err != nil {
		return page, err
	}
	if len(page.Items) > o.Limit {
		page.Items = page.Items[:o.Limit]
		cursor := httpx.EncodeCursor(page.Items[len(page.Items)-1].ID)
		page.NextCursor = &cursor
	}
	return page, nil
}

func (s Service) Get(ctx context.Context, id string) (domain.Ticket, error) {
	t, err := scan(s.db.QueryRow(ctx, `SELECT `+columns+` FROM ticket WHERE id = $1 AND distributor_id = $2`, id, s.tenant))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Ticket{}, httpx.NotFound("Ticket", id)
	}
	return t, err
}

func (s Service) Create(ctx context.Context, in CreateInput) (domain.Ticket, error) {
	var exists bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM device WHERE id = $1 AND outlet_id = $2 AND distributor_id = $3)`,
		in.DeviceID, in.OutletID, s.tenant).Scan(&exists); err != nil {
		return domain.Ticket{}, err
	}
	if !exists {
		return domain.Ticket{}, httpx.NotFound("Device", in.DeviceID)
	}

	status := domain.TicketOpen
	if in.TechnicianID != nil {
		status = domain.TicketScheduled
	}
	return scan(s.db.QueryRow(ctx, `
		INSERT INTO ticket (id, distributor_id, outlet_id, device_id, sensor_id, type, priority, status, title, description,
			technician_id, created_at, scheduled_at)
		VALUES ('MT-' || nextval('ticket_seq'),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING `+columns,
		s.tenant, in.OutletID, in.DeviceID, in.SensorID, in.Type, in.Priority, status, in.Title, in.Description,
		in.TechnicianID, s.ctx.Now, in.ScheduledAt))
}

func (s Service) Patch(ctx context.Context, id string, in PatchInput) (domain.Ticket, error) {
	ticket, err := s.Get(ctx, id)
	if err != nil {
		return domain.Ticket{}, err
	}
	if s.ctx.Kind == auth.KindEmployee {
		return domain.Ticket{}, httpx.Forbidden("Employees report issues but do not work tickets")
	}
	if s.ctx.Kind == auth.KindTechnician && ticket.TechnicianID != nil && *ticket.TechnicianID != s.ctx.UserID {
		return domain.Ticket{}, httpx.Forbidden("Ticket is assigned to another technician")
	}
	if in.Status != nil && *in.Status != ticket.Status && !CanTransition(ticket.Status, *in.Status) {
		return domain.Ticket{}, httpx.Conflict("INVALID_TRANSITION",
			fmt.Sprintf("Cannot move a ticket from %s to %s", ticket.Status, *in.Status))
	}

	completing := in.Status != nil && *in.Status == domain.TicketDone && ticket.Status != domain.TicketDone
	completedAt := ticket.CompletedAt
	if completing {
		completedAt = &s.ctx.Now
	}

	updated, err := scan(s.db.QueryRow(ctx, `
		UPDATE ticket SET
			status        = COALESCE($3, status),
			priority      = COALESCE($4, priority),
			technician_id = COALESCE($5, technician_id),
			scheduled_at  = COALESCE($6, scheduled_at),
			notes         = COALESCE($7, notes),
			parts_used    = COALESCE($8, parts_used),
			photo_urls    = COALESCE($9, photo_urls),
			completed_at  = $10
		WHERE id = $1 AND distributor_id = $2
		RETURNING `+columns,
		id, s.tenant, statusText(in.Status), priorityText(in.Priority), in.TechnicianID, in.ScheduledAt,
		in.Notes, in.PartsUsed, in.PhotoURLs, completedAt))
	if err != nil {
		return domain.Ticket{}, err
	}
	if completing {
		if err := jobs.Emit(ctx, s.db, s.queue, jobs.TicketCompleted,
			jobs.Payload{"ticketId": id, "outletId": ticket.OutletID, "deviceId": ticket.DeviceID}); err != nil {
			return domain.Ticket{}, err
		}
	}
	return updated, nil
}

func statusText(v *domain.TicketStatus) *string {
	if v == nil {
		return nil
	}
	s := string(*v)
	return &s
}

func priorityText(v *domain.TicketPriority) *string {
	if v == nil {
		return nil
	}
	s := string(*v)
	return &s
}

type scanner interface{ Scan(dest ...any) error }

func scan(s scanner) (domain.Ticket, error) {
	var t domain.Ticket
	err := s.Scan(&t.ID, &t.DistributorID, &t.OutletID, &t.DeviceID, &t.SensorID, &t.Type, &t.Priority, &t.Status,
		&t.Title, &t.Description, &t.TechnicianID, &t.CreatedAt, &t.ScheduledAt, &t.CompletedAt,
		&t.PartsUsed, &t.Notes, &t.PhotoURLs)
	return t, err
}

// Routes mounts under /distributors/{distributorId}/tickets.
func Routes(db store.DB, q jobs.Queue) chi.Router {
	r := chi.NewRouter()

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		page, err := NewService(db, c, q).List(req.Context(), ListOpts{
			Cursor:       req.URL.Query().Get("cursor"),
			Limit:        httpx.Limit(req, 50, 200),
			OutletID:     req.URL.Query().Get("outletId"),
			Status:       req.URL.Query().Get("status"),
			TechnicianID: req.URL.Query().Get("technicianId"),
		})
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, page)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in CreateInput
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		ticket, err := NewService(db, c, q).Create(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, ticket)
	})

	r.Patch("/{ticketId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in PatchInput
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		ticket, err := NewService(db, c, q).Patch(req.Context(), chi.URLParam(req, "ticketId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, ticket)
	})

	return r
}
