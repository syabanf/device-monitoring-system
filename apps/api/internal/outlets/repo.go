package outlets

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

const columns = `id, distributor_id, code, name, address, city, province, lat, lng, maps_url, open_time, close_time, timezone, phone`

// Repo holds every SQL statement for outlets. Each one filters by tenant, the server-side
// twin of useScoped() in the apps.
type Repo struct {
	db     store.DB
	tenant string
}

func NewRepo(db store.DB, tenant string) Repo { return Repo{db: db, tenant: tenant} }

type ListOpts struct {
	Cursor string
	Limit  int
	Query  string
}

func (r Repo) List(ctx context.Context, o ListOpts) (httpx.Page[domain.Outlet], error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+columns+` FROM outlet
		WHERE distributor_id = $1
		  AND ($2 = '' OR code > $2)
		  AND ($3 = '' OR name ILIKE '%'||$3||'%' OR code ILIKE '%'||$3||'%' OR address ILIKE '%'||$3||'%')
		ORDER BY code
		LIMIT $4`, r.tenant, httpx.DecodeCursor(o.Cursor), o.Query, o.Limit+1)
	if err != nil {
		return httpx.Page[domain.Outlet]{}, err
	}
	defer rows.Close()

	page := httpx.Page[domain.Outlet]{Items: []domain.Outlet{}}
	for rows.Next() {
		o, err := scan(rows)
		if err != nil {
			return page, err
		}
		page.Items = append(page.Items, o)
	}
	if err := rows.Err(); err != nil {
		return page, err
	}
	if len(page.Items) > o.Limit {
		page.Items = page.Items[:o.Limit]
		cursor := httpx.EncodeCursor(page.Items[len(page.Items)-1].Code)
		page.NextCursor = &cursor
	}
	return page, nil
}

func (r Repo) Find(ctx context.Context, id string) (domain.Outlet, error) {
	row := r.db.QueryRow(ctx, `SELECT `+columns+` FROM outlet WHERE id = $1 AND distributor_id = $2`, id, r.tenant)
	o, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Outlet{}, httpx.NotFound("Outlet", id)
	}
	return o, err
}

func (r Repo) CodeTaken(ctx context.Context, code, exceptID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM outlet WHERE distributor_id = $1 AND code = $2 AND id <> $3)`,
		r.tenant, code, exceptID).Scan(&exists)
	return exists, err
}

func (r Repo) Insert(ctx context.Context, o domain.Outlet) (domain.Outlet, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO outlet (id, distributor_id, code, name, address, city, province, lat, lng, maps_url, open_time, close_time, timezone, phone)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		RETURNING `+columns,
		o.ID, r.tenant, o.Code, o.Name, o.Address, o.City, o.Province, o.Lat, o.Lng, o.MapsURL, o.OpenTime, o.CloseTime, o.Timezone, o.Phone)
	return scan(row)
}

func (r Repo) Update(ctx context.Context, o domain.Outlet) (domain.Outlet, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE outlet SET code=$3, name=$4, address=$5, city=$6, province=$7, lat=$8, lng=$9, maps_url=$10,
		                  open_time=$11, close_time=$12, timezone=$13, phone=$14
		WHERE id = $1 AND distributor_id = $2
		RETURNING `+columns,
		o.ID, r.tenant, o.Code, o.Name, o.Address, o.City, o.Province, o.Lat, o.Lng, o.MapsURL, o.OpenTime, o.CloseTime, o.Timezone, o.Phone)
	out, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Outlet{}, httpx.NotFound("Outlet", o.ID)
	}
	return out, err
}

// Delete relies on the foreign keys: devices, sensors, alerts, tickets and contacts cascade.
func (r Repo) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM outlet WHERE id = $1 AND distributor_id = $2`, id, r.tenant)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("Outlet", id)
	}
	return nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scan(s scanner) (domain.Outlet, error) {
	var o domain.Outlet
	err := s.Scan(&o.ID, &o.DistributorID, &o.Code, &o.Name, &o.Address, &o.City, &o.Province,
		&o.Lat, &o.Lng, &o.MapsURL, &o.OpenTime, &o.CloseTime, &o.Timezone, &o.Phone)
	return o, err
}
