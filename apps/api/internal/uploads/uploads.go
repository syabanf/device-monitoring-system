// Package uploads keeps the photos an employee attaches to an alert response and a technician
// attaches to a finished ticket. The store is an interface so the deployment can move from a
// mounted disk to object storage without touching the handlers.
package uploads

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/httpx"
)

const (
	// maxBytes caps one photo. A phone camera shot fits; a video does not.
	maxBytes = 5 << 20
	// maxPhotos caps one alert response or one ticket.
	maxPhotos = 6
	// pathPrefix is where an upload answers, and the only prefix a stored photo may carry.
	pathPrefix = "/uploads/"
)

// types maps the content types we accept onto the extension the file is stored under.
var types = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type Store interface {
	// Save writes one photo and returns the path the frontend renders, such as
	// /uploads/pho-m1abc123.jpg.
	Save(ctx context.Context, body []byte, contentType string) (string, error)
	// Open reads a stored photo back. The caller closes it.
	Open(ctx context.Context, name string) (io.ReadCloser, string, error)
}

// Disk stores photos in one flat directory. Names carry enough entropy that the directory
// never needs an index and a link never needs guessing.
type Disk struct{ dir string }

func NewDisk(dir string) (Disk, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return Disk{}, fmt.Errorf("upload directory %s: %w", dir, err)
	}
	return Disk{dir: dir}, nil
}

func (d Disk) Save(_ context.Context, body []byte, contentType string) (string, error) {
	ext, ok := types[contentType]
	if !ok {
		return "", httpx.BadRequest("UNSUPPORTED_MEDIA_TYPE", "Photos must be JPEG, PNG or WebP")
	}
	name := httpx.NewID("pho") + ext
	if err := os.WriteFile(filepath.Join(d.dir, name), body, 0o644); err != nil {
		return "", err
	}
	return pathPrefix + name, nil
}

func (d Disk) Open(_ context.Context, name string) (io.ReadCloser, string, error) {
	contentType, ok := contentTypeOf(name)
	if !ok {
		return nil, "", httpx.NotFound("Photo", name)
	}
	file, err := os.Open(filepath.Join(d.dir, name))
	if os.IsNotExist(err) {
		return nil, "", httpx.NotFound("Photo", name)
	}
	if err != nil {
		return nil, "", err
	}
	return file, contentType, nil
}

// contentTypeOf also rejects a name that could escape the directory, since the name comes
// from the URL.
func contentTypeOf(name string) (string, bool) {
	if name == "" || name != filepath.Base(name) || strings.HasPrefix(name, ".") {
		return "", false
	}
	for contentType, ext := range types {
		if strings.HasSuffix(name, ext) {
			return contentType, true
		}
	}
	return "", false
}

// read pulls one photo out of a multipart form, refusing anything too large or not an image.
// It sniffs the bytes rather than trusting the browser's content type.
func read(req *http.Request) ([]byte, string, error) {
	file, header, err := req.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return nil, "", tooLarge()
		}
		return nil, "", httpx.BadRequest("VALIDATION_FAILED", "Send the photo as a multipart field named file")
	}
	defer file.Close()

	if header.Size > maxBytes {
		return nil, "", tooLarge()
	}
	body, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return nil, "", err
	}
	if len(body) > maxBytes {
		return nil, "", tooLarge()
	}

	contentType := http.DetectContentType(body)
	if _, ok := types[contentType]; !ok {
		return nil, "", httpx.NewError("UNSUPPORTED_MEDIA_TYPE", http.StatusUnsupportedMediaType,
			"Unsupported media type", "Photos must be JPEG, PNG or WebP, this file is "+contentType)
	}
	return body, contentType, nil
}

func tooLarge() error {
	return httpx.NewError("PAYLOAD_TOO_LARGE", http.StatusRequestEntityTooLarge, "Photo too large",
		fmt.Sprintf("A photo may be at most %d MB", maxBytes>>20))
}

// Validate checks the photo list a response or a ticket carries. Entries point at our own
// uploads, so a saved record cannot embed a link to somewhere else.
func Validate(photos []string) error {
	if len(photos) > maxPhotos {
		return fmt.Errorf("a response carries at most %d photos", maxPhotos)
	}
	for _, p := range photos {
		name, found := strings.CutPrefix(p, pathPrefix)
		if _, ok := contentTypeOf(name); !found || !ok {
			return fmt.Errorf("photo %q is not an upload from this API", p)
		}
	}
	return nil
}
