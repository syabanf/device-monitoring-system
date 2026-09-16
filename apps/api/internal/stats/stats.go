// Package stats answers the dashboard and analysis screens with aggregates computed in the
// database, so those pages stop loading every alert into the browser.
package stats

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

type Summary struct {
	Period          string         `json:"period"`
	From            time.Time      `json:"from"`
	AlertsByStatus  map[string]int `json:"alertsByStatus"`
	Open            int            `json:"open"`
	Solved          int            `json:"solved"`
	Total           int            `json:"total"`
	AvgResponseSec  *int           `json:"avgResponseSec"`
	ResponseRate    *float64       `json:"responseRate"`
	PerDay          []DayBucket    `json:"perDay"`
	ByOutlet        []OutletStat   `json:"byOutlet"`
	Devices         DeviceCounts   `json:"devices"`
	Tickets         TicketCounts   `json:"tickets"`
	PendingAccounts int            `json:"pendingAccounts"`
}

type DayBucket struct {
	Day      string `json:"day"`
	Comfort  int    `json:"COMFORT"`
	Security int    `json:"SECURITY"`
	Total    int    `json:"total"`
}

type OutletStat struct {
	OutletID string `json:"outletId"`
	AvgSec   int    `json:"avgSec"`
	Count    int    `json:"count"`
}

type DeviceCounts struct {
	Total   int `json:"total"`
	Online  int `json:"online"`
	Offline int `json:"offline"`
}

type TicketCounts struct {
	Open    int `json:"open"`
	Overdue int `json:"overdue"`
	Done    int `json:"done"`
}

type Service struct {
	db     store.DB
	tenant string
	scope  []string
}

func NewService(db store.DB, c auth.Ctx) Service {
	return Service{db: db, tenant: c.Tenant, scope: c.OutletScope()}
}

// PeriodStart maps the dashboard's period switch onto a timestamp.
func PeriodStart(period string, now time.Time) time.Time {
	switch period {
	case "today":
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case "30d":
		return now.AddDate(0, 0, -30)
	case "all":
		return time.Unix(0, 0).UTC()
	default:
		return now.AddDate(0, 0, -7)
	}
}

func (s Service) Summary(ctx context.Context, period string, now time.Time) (Summary, error) {
	from := PeriodStart(period, now)
	out := Summary{Period: period, From: from, AlertsByStatus: map[string]int{}, PerDay: []DayBucket{}, ByOutlet: []OutletStat{}}

	rows, err := s.db.Query(ctx, `
		SELECT status::text, count(*) FROM alert
		WHERE distributor_id = $1 AND trigger_time >= $2 AND ($3::text[] IS NULL OR outlet_id = ANY($3))
		GROUP BY status`, s.tenant, from, s.scope)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var status string
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			rows.Close()
			return out, err
		}
		out.AlertsByStatus[status] = n
		out.Total += n
		if status == "RESOLVED" || status == "VERIFIED" {
			out.Solved += n
		} else {
			out.Open += n
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, err
	}

	var avg *float64
	var responded, total int
	if err := s.db.QueryRow(ctx, `
		SELECT avg(r.response_duration_sec), count(r.alert_id), count(a.id)
		FROM alert a LEFT JOIN alert_response r ON r.alert_id = a.id
		WHERE a.distributor_id = $1 AND a.trigger_time >= $2 AND ($3::text[] IS NULL OR a.outlet_id = ANY($3))`,
		s.tenant, from, s.scope).Scan(&avg, &responded, &total); err != nil {
		return out, err
	}
	if avg != nil {
		seconds := int(*avg)
		out.AvgResponseSec = &seconds
	}
	if total > 0 {
		rate := float64(responded) / float64(total)
		out.ResponseRate = &rate
	}

	dayRows, err := s.db.Query(ctx, `
		SELECT to_char(date_trunc('day', trigger_time), 'YYYY-MM-DD') AS day,
		       count(*) FILTER (WHERE category = 'COMFORT'),
		       count(*) FILTER (WHERE category = 'SECURITY'),
		       count(*)
		FROM alert
		WHERE distributor_id = $1 AND trigger_time >= $2 AND ($3::text[] IS NULL OR outlet_id = ANY($3))
		GROUP BY day ORDER BY day`, s.tenant, from, s.scope)
	if err != nil {
		return out, err
	}
	for dayRows.Next() {
		var b DayBucket
		if err := dayRows.Scan(&b.Day, &b.Comfort, &b.Security, &b.Total); err != nil {
			dayRows.Close()
			return out, err
		}
		out.PerDay = append(out.PerDay, b)
	}
	dayRows.Close()
	if err := dayRows.Err(); err != nil {
		return out, err
	}

	outletRows, err := s.db.Query(ctx, `
		SELECT a.outlet_id, avg(r.response_duration_sec)::int, count(*)
		FROM alert a JOIN alert_response r ON r.alert_id = a.id
		WHERE a.distributor_id = $1 AND a.trigger_time >= $2 AND ($3::text[] IS NULL OR a.outlet_id = ANY($3))
		GROUP BY a.outlet_id ORDER BY avg(r.response_duration_sec)`, s.tenant, from, s.scope)
	if err != nil {
		return out, err
	}
	for outletRows.Next() {
		var st OutletStat
		if err := outletRows.Scan(&st.OutletID, &st.AvgSec, &st.Count); err != nil {
			outletRows.Close()
			return out, err
		}
		out.ByOutlet = append(out.ByOutlet, st)
	}
	outletRows.Close()
	if err := outletRows.Err(); err != nil {
		return out, err
	}

	if err := s.db.QueryRow(ctx, `
		SELECT count(*), count(*) FILTER (WHERE status = 'online'), count(*) FILTER (WHERE status = 'offline')
		FROM device WHERE distributor_id = $1 AND ($2::text[] IS NULL OR outlet_id = ANY($2))`,
		s.tenant, s.scope).Scan(&out.Devices.Total, &out.Devices.Online, &out.Devices.Offline); err != nil {
		return out, err
	}

	if err := s.db.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE status <> 'DONE'),
		       count(*) FILTER (WHERE status <> 'DONE' AND scheduled_at IS NOT NULL AND scheduled_at < $3),
		       count(*) FILTER (WHERE status = 'DONE')
		FROM ticket WHERE distributor_id = $1 AND ($2::text[] IS NULL OR outlet_id = ANY($2))`,
		s.tenant, s.scope, now).Scan(&out.Tickets.Open, &out.Tickets.Overdue, &out.Tickets.Done); err != nil {
		return out, err
	}

	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM employee WHERE distributor_id = $1 AND registration_status = 'pending'`,
		s.tenant).Scan(&out.PendingAccounts); err != nil {
		return out, err
	}
	return out, nil
}

// Routes mounts at /distributors/{distributorId}/stats.
func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()
	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		period := req.URL.Query().Get("period")
		if period == "" {
			period = "7d"
		}
		summary, err := NewService(db, c).Summary(req.Context(), period, time.Now().UTC())
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, summary)
	})
	return r
}
