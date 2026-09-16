package stats

import (
	"testing"
	"time"
)

func TestPeriodStart(t *testing.T) {
	now := time.Date(2026, 9, 16, 15, 30, 0, 0, time.UTC)
	cases := map[string]time.Time{
		"today": time.Date(2026, 9, 16, 0, 0, 0, 0, time.UTC),
		"7d":    now.AddDate(0, 0, -7),
		"30d":   now.AddDate(0, 0, -30),
	}
	for period, want := range cases {
		if got := PeriodStart(period, now); !got.Equal(want) {
			t.Errorf("%s: want %s, got %s", period, want, got)
		}
	}
	if PeriodStart("all", now).Year() != 1970 {
		t.Error("all time starts at the epoch")
	}
	if !PeriodStart("nonsense", now).Equal(now.AddDate(0, 0, -7)) {
		t.Error("an unknown period falls back to the last 7 days")
	}
}
