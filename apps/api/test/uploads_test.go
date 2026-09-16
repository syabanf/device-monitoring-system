package test

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// samplePNG encodes a small real image, so the content sniffing under test sees what a phone
// would send rather than a hand-written header.
func samplePNG(t *testing.T, side int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, side, side))
	for x := range side {
		for y := range side {
			img.Set(x, y, color.RGBA{R: uint8(x), G: uint8(y), B: 40, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// upload posts one file the way the PWA's photo picker does.
func (c client) upload(filename string, body []byte) response {
	c.t.Helper()
	var form bytes.Buffer
	w := multipart.NewWriter(&form)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		c.t.Fatal(err)
	}
	if _, err := part.Write(body); err != nil {
		c.t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		c.t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/uploads", bytes.NewReader(form.Bytes()))
	req.Header.Set("Content-Type", w.FormDataContentType())
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return response{t: c.t, Status: rec.Code, Body: rec.Body.Bytes()}
}

// photo uploads one picture and returns the path a response or a ticket stores.
func photo(t *testing.T, token string) string {
	t.Helper()
	return as(t, token).upload("proof.png", samplePNG(t, 8)).expect(http.StatusCreated).str("url")
}

func TestUploadRoundTrip(t *testing.T) {
	f := reset(t)
	body := samplePNG(t, 16)

	created := as(t, f.EmployeeToken).upload("proof.png", body).expect(http.StatusCreated)
	url := created.str("url")
	if !strings.HasPrefix(url, "/uploads/pho-") || !strings.HasSuffix(url, ".png") {
		t.Fatalf("the upload answered %q", url)
	}
	if got := created.str("contentType"); got != "image/png" {
		t.Errorf("want image/png, got %s", got)
	}

	// Reading it back needs no token, which is what an <img> tag can manage.
	fetched := as(t, "").get(url).expect(http.StatusOK)
	if !bytes.Equal(fetched.Body, body) {
		t.Errorf("the stored photo is %d bytes, the original was %d", len(fetched.Body), len(body))
	}
}

func TestUploadRejections(t *testing.T) {
	f := reset(t)

	as(t, "").upload("proof.png", samplePNG(t, 4)).expect(http.StatusUnauthorized)
	as(t, f.EmployeeToken).upload("notes.txt", []byte("plain text, not a photo")).
		expect(http.StatusUnsupportedMediaType)
	// A .png name does not make a file a PNG; the bytes decide.
	as(t, f.EmployeeToken).upload("liar.png", []byte("plain text, not a photo")).
		expect(http.StatusUnsupportedMediaType)
	as(t, f.EmployeeToken).upload("huge.png", bytes.Repeat([]byte{0x89}, 6<<20)).
		expect(http.StatusRequestEntityTooLarge)
}

func TestDownloadRejectsNamesThatAreNotStoredPhotos(t *testing.T) {
	reset(t)
	anon := as(t, "")

	anon.get("/uploads/pho-missing.png").expect(http.StatusNotFound)
	anon.get("/uploads/server.go").expect(http.StatusNotFound)
	anon.get("/uploads/..%2f..%2fgo.mod").expect(http.StatusNotFound)
}

func TestRespondingStoresThePhoto(t *testing.T) {
	f := reset(t)
	employee := as(t, f.EmployeeToken)
	url := photo(t, f.EmployeeToken)

	responded := employee.post("/alerts/9001/respond", map[string]any{
		"notes": "Pintu chiller ditutup kembali", "photoUrls": []string{url},
	}).expect(http.StatusOK)
	photos := responded.field("response.photoUrls").([]any)
	if len(photos) != 1 || photos[0] != url {
		t.Fatalf("the response carries %v", photos)
	}
	as(t, "").get(photos[0].(string)).expect(http.StatusOK)
}

func TestPhotoListsMustPointAtOurOwnUploads(t *testing.T) {
	f := reset(t)
	employee := as(t, f.EmployeeToken)

	employee.post("/alerts/9001/respond", map[string]any{
		"notes": "ok", "photoUrls": []string{"https://cdn.example.com/a.jpg"},
	}).expect(http.StatusBadRequest)

	url := photo(t, f.EmployeeToken)
	many := make([]string, 7)
	for i := range many {
		many[i] = url
	}
	employee.post("/alerts/9001/respond", map[string]any{"notes": "ok", "photoUrls": many}).
		expect(http.StatusBadRequest)

	as(t, f.AdminToken).patch(f.path("/tickets/MT-2600"), map[string]any{
		"photoUrls": []string{"/uploads/../go.mod"},
	}).expect(http.StatusBadRequest)
}
