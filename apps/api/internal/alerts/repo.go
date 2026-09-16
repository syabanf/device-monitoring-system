package alerts

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const columns = `a.id, a.distributor_id, a.outlet_id, a.device_id, a.sensor_id, a.sensor_name, a.sensor_type, a.category,
	a.status, a.trigger_value, a.trigger_time, a.clear_value, a.clear_time, a.message, a.channels, a.assignee_employee_id,
	a.acknowledged_at, a.responding_at, a.resolved_at, a.verified_at,
	r.employee_id, r.notes, r.photo_urls, r.responded_at, r.response_duration_sec`

const from = ` FROM alert a LEFT JOIN alert_response r ON r.alert_id = a.id`

type Repo struct {
	db     store.DB
	tenant string
}

func NewRepo(db store.DB, tenant string) Repo { return Repo{db: db, tenant: tenant} }

type ListOpts struct {
	Cursor   string
	Limit    int
	OutletID string
	Status   string
	Category string
	Since    string
}

// List returns newest first. The cursor carries both sort keys so equal timestamps stay stable.
func (r Repo) List(ctx context.Context, o ListOpts) (httpx.Page[domain.Alert], error) {
	var afterTime, afterID string
	if parts := strings.SplitN(httpx.DecodeCursor(o.Cursor), "|", 2); len(parts) == 2 {
		afterTime, afterID = parts[0], parts[1]
	}
	rows, err := r.db.Query(ctx, `
		SELECT `+columns+from+`
		WHERE a.distributor_id = $1
		  AND ($2 = '' OR a.outlet_id = $2)
		  AND ($3 = '' OR a.status::text = $3)
		  AND ($4 = '' OR a.category::text = $4)
		  AND ($5 = '' OR a.trigger_time >= $5::timestamptz)
		  AND ($6 = '' OR a.trigger_time < $6::timestamptz OR (a.trigger_time = $6::timestamptz AND a.id < $7::bigint))
		ORDER BY a.trigger_time DESC, a.id DESC
		LIMIT $8`,
		r.tenant, o.OutletID, o.Status, o.Category, o.Since, afterTime, zeroIfEmpty(afterID), o.Limit+1)
	if err != nil {
		return httpx.Page[domain.Alert]{}, err
	}
	defer rows.Close()

	page := httpx.Page[domain.Alert]{Items: []domain.Alert{}}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return page, err
		}
		page.Items = append(page.Items, a)
	}
	if err := rows.Err(); err != nil {
		return page, err
	}
	if len(page.Items) > o.Limit {
		page.Items = page.Items[:o.Limit]
		last := page.Items[len(page.Items)-1]
		cursor := httpx.EncodeCursor(last.TriggerTime.Format(time.RFC3339Nano) + "|" + strconv.FormatInt(last.ID, 10))
		page.NextCursor = &cursor
	}
	return page, nil
}

func (r Repo) Find(ctx context.Context, id int64) (domain.Alert, error) {
	a, err := scan(r.db.QueryRow(ctx, `SELECT `+columns+from+` WHERE a.id = $1 AND a.distributor_id = $2`, id, r.tenant))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Alert{}, httpx.NotFound("Alert", strconv.FormatInt(id, 10))
	}
	return a, err
}

// Claim is how the first responder wins: the update only matches while nobody holds the alert,
// so a second employee tapping at the same moment changes no rows.
func (r Repo) Claim(ctx context.Context, id int64, employeeID string, at time.Time) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE alert SET assignee_employee_id = $3, responding_at = $4, status = 'RESPONDING'
		WHERE id = $1 AND distributor_id = $2 AND assignee_employee_id IS NULL`, id, r.tenant, employeeID, at)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (r Repo) SaveResponse(ctx context.Context, id int64, employeeID, notes string, photos []string, at time.Time, durationSec int) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO alert_response (alert_id, employee_id, notes, photo_urls, responded_at, response_duration_sec)
		VALUES ($1,$2,$3,$4,$5,$6)`, id, employeeID, notes, photos, at, durationSec)
	return err
}

func (r Repo) SetStatus(ctx context.Context, id int64, status domain.AlertStatus, at time.Time, clearValue *string) error {
	// $3 is both compared as text and stored as the enum, so each use is cast explicitly.
	// Postgres cannot deduce one type for a bare parameter used in both positions.
	_, err := r.db.Exec(ctx, `
		UPDATE alert SET status = $3::alert_status,
			acknowledged_at = CASE WHEN $3::text = 'ACKNOWLEDGED' THEN $4 ELSE acknowledged_at END,
			responding_at   = CASE WHEN $3::text = 'RESPONDING'   THEN $4 ELSE responding_at END,
			resolved_at     = CASE WHEN $3::text = 'RESOLVED'     THEN $4 ELSE resolved_at END,
			verified_at     = CASE WHEN $3::text = 'VERIFIED'     THEN $4 ELSE verified_at END,
			clear_time      = CASE WHEN $3::text = 'RESOLVED'     THEN $4 ELSE clear_time END,
			clear_value     = CASE WHEN $3::text = 'RESOLVED'     THEN $5 ELSE clear_value END
		WHERE id = $1 AND distributor_id = $2`, id, r.tenant, string(status), at, clearValue)
	return err
}

func zeroIfEmpty(v string) string {
	if v == "" {
		return "0"
	}
	return v
}

type scanner interface{ Scan(dest ...any) error }

func scan(s scanner) (domain.Alert, error) {
	var a domain.Alert
	var (
		channels    []string
		employeeID  *string
		notes       *string
		photos      []string
		respondedAt *time.Time
		duration    *int
	)
	err := s.Scan(&a.ID, &a.DistributorID, &a.OutletID, &a.DeviceID, &a.SensorID, &a.SensorName, &a.SensorType, &a.Category,
		&a.Status, &a.TriggerValue, &a.TriggerTime, &a.ClearValue, &a.ClearTime, &a.Message, &channels, &a.AssigneeEmployeeID,
		&a.AcknowledgedAt, &a.RespondingAt, &a.ResolvedAt, &a.VerifiedAt,
		&employeeID, &notes, &photos, &respondedAt, &duration)
	if err != nil {
		return a, err
	}
	a.Channels = domain.ChannelsFrom(channels)
	if employeeID != nil && respondedAt != nil && duration != nil {
		a.Response = &domain.AlertResponse{
			EmployeeID: *employeeID, Notes: deref(notes), PhotoURLs: photos,
			RespondedAt: *respondedAt, ResponseDurationSec: *duration,
		}
	}
	return a, nil
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
