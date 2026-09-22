package store_test

import (
	"regexp"
	"testing"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/auth"
	"github.com/syabanf/device-monitoring-system/apps/api/internal/store"
)

// The admin seed carries a precomputed hash. If it drifts from the password format, every
// fresh install ships an account nobody can sign in with, so the hash is checked here.
func TestSeededAdminPasswordVerifies(t *testing.T) {
	body, err := store.MigrationFile("0003_seed_admin.sql")
	if err != nil {
		t.Fatal(err)
	}
	hashes := regexp.MustCompile(`pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]+`).FindAllString(body, -1)
	if len(hashes) != 3 {
		t.Fatalf("want a hash for each of the 3 admins, found %d", len(hashes))
	}
	for _, h := range hashes {
		if !auth.VerifyPassword("admin123", h) {
			t.Errorf("hash %s does not verify against the documented password", h[:24])
		}
	}
}
