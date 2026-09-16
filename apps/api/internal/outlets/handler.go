package outlets

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// Routes mounts under /distributors/{distributorId}. Handlers parse, call one service method
// and respond. They hold no rules.
func Routes(db store.DB) chi.Router {
	r := chi.NewRouter()

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		page, err := NewService(db, c).List(req.Context(), ListOpts{
			Cursor: req.URL.Query().Get("cursor"),
			Limit:  httpx.Limit(req, 50, 200),
			Query:  req.URL.Query().Get("q"),
		})
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, page)
	})

	r.Get("/{outletId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Tenant(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		outlet, err := NewService(db, c).Get(req.Context(), chi.URLParam(req, "outletId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, outlet)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		outlet, err := NewService(db, c).Create(req.Context(), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, outlet)
	})

	r.Put("/{outletId}", func(w http.ResponseWriter, req *http.Request) {
		c, in, err := adminInput(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		outlet, err := NewService(db, c).Update(req.Context(), chi.URLParam(req, "outletId"), in)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusOK, outlet)
	})

	r.Delete("/{outletId}", func(w http.ResponseWriter, req *http.Request) {
		c, err := auth.Admin(req, chi.URLParam(req, "distributorId"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		if err := NewService(db, c).Delete(req.Context(), chi.URLParam(req, "outletId")); err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusNoContent, nil)
	})

	return r
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
