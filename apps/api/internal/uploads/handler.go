package uploads

import (
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
)

// Upload takes one photo and answers the path to store in a response or a ticket. It sits
// behind the session middleware: only a signed-in employee, technician or admin may write.
func Upload(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		req.Body = http.MaxBytesReader(w, req.Body, maxBytes+1<<16)
		body, contentType, err := read(req)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		path, err := store.Save(req.Context(), body, contentType)
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, map[string]any{"url": path, "contentType": contentType, "bytes": len(body)})
	}
}

// Download serves a stored photo. It stays outside the session middleware because an <img>
// tag cannot carry an Authorization header; the random file name is what keeps a photo private.
func Download(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		file, contentType, err := store.Open(req.Context(), chi.URLParam(req, "name"))
		if err != nil {
			httpx.Fail(w, req, err)
			return
		}
		defer file.Close()
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "private, max-age=86400")
		if _, err := io.Copy(w, file); err != nil {
			httpx.Fail(w, req, err)
		}
	}
}
