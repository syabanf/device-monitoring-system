package devices

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		page, err := NewService(db, c).List(req.Context(), ListOpts{
			Cursor:   req.URL.Query().Get("cursor"),
			Limit:    httpx.Limit(req, 50, 200),
			OutletID: req.URL.Query().Get("outletId"),
			Status:   req.URL.Query().Get("status"),
		})
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, page)
	})

	r.Get("/{deviceId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		out, err := NewService(db, c).Get(req.Context(), chi.URLParam(req, "deviceId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, out)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in CreateInput
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		out, err := NewService(db, c).Create(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, out)
	})

	r.Put("/{deviceId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in UpdateInput
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		out, err := NewService(db, c).Update(req.Context(), chi.URLParam(req, "deviceId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, out)
	})

	r.Delete("/{deviceId}/sensors/{sensorId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		if err := NewService(db, c).DeleteSensor(req.Context(), chi.URLParam(req, "deviceId"), chi.URLParam(req, "sensorId")); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusNoContent, nil)
	})

	r.Delete("/{deviceId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		if err := NewService(db, c).Delete(req.Context(), chi.URLParam(req, "deviceId")); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusNoContent, nil)
	})

	r.Put("/{deviceId}/sensors/{sensorId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		var in SensorInput
		if err := httpx.Decode(req, &in); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		sensor, err := NewService(db, c).UpsertSensor(req.Context(), chi.URLParam(req, "deviceId"), chi.URLParam(req, "sensorId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, sensor)
	})

	return r
}
