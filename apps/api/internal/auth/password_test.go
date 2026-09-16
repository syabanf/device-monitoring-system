package auth

import "testing"

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("admin123")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword("admin123", hash) {
		t.Fatal("the right password should verify")
	}
	if VerifyPassword("admin124", hash) {
		t.Fatal("a wrong password must not verify")
	}
	if VerifyPassword("admin123", "not-a-hash") {
		t.Fatal("a malformed hash must not verify")
	}
}
