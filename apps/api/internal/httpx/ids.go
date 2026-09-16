package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"time"
)

// NewID mirrors the frontend reducer's newId(): a readable prefix plus enough entropy.
func NewID(prefix string) string {
	buf := make([]byte, 3)
	_, _ = rand.Read(buf)
	return prefix + "-" + strconv.FormatInt(time.Now().UnixMilli(), 36) + hex.EncodeToString(buf)
}
