package alerts

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/jobs"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// TenantRoutes mounts the list under /distributors/{distributorId}/alerts.
func TenantRoutes(db store.DB, q jobs.Queue) chi.Router {
	r := chi.NewRouter()
	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		page, err := NewService(db, c, q).List(req.Context(), ListOpts{
			Cursor:   req.URL.Query().Get("cursor"),
			Limit:    httpx.Limit(req, 50, 200),
			OutletID: req.URL.Query().Get("outletId"),
			Status:   req.URL.Query().Get("status"),
			Category: req.URL.Query().Get("category"),
			Since:    req.URL.Query().Get("since"),
		})
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, page)
	})
	return r
}

// ItemRoutes mounts the per-alert actions at /alerts, where the mobile app addresses them.
func ItemRoutes(db store.DB, q jobs.Queue) chi.Router {
	r := chi.NewRouter()

	r.Get("/{alertId}", func(w http.ResponseWriter, req *http.Request) {
		c, id, err := alertRequest(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		alert, err := NewService(db, c, q).Get(req.Context(), id)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, alert)
	})

	r.Post("/{alertId}/respond", func(w http.ResponseWriter, req *http.Request) {
		c, id, err := alertRequest(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in RespondInput
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		alert, err := NewService(db, c, q).Respond(req.Context(), id, in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, alert)
	})

	r.Post("/{alertId}/status", func(w http.ResponseWriter, req *http.Request) {
		c, id, err := alertRequest(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in StatusInput
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		alert, err := NewService(db, c, q).SetStatus(req.Context(), id, in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, alert)
	})

	return r
}

func alertRequest(req *http.Request) (auth.Ctx, int64, error) {
	c, err := auth.From(req)
	if err != nil {
		return auth.Ctx{}, 0, err
	}
	id, err := strconv.ParseInt(chi.URLParam(req, "alertId"), 10, 64)
	if err != nil || id <= 0 {
		return auth.Ctx{}, 0, httpx.BadRequest("VALIDATION_FAILED", "alertId must be a positive number")
	}
	return c, id, nil
}
