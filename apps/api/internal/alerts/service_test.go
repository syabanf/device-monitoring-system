package alerts

import (
	"testing"

	"github.com/syabanf/device-monitoring-system/apps/api/internal/domain"
)

func TestLifecycleOnlyMovesForward(t *testing.T) {
	allowed := [][2]domain.AlertStatus{
		{domain.AlertUnacknowledged, domain.AlertAcknowledged},
		{domain.AlertUnacknowledged, domain.AlertResolved},
		{domain.AlertAcknowledged, domain.AlertResponding},
		{domain.AlertResponding, domain.AlertResolved},
		{domain.AlertResolved, domain.AlertVerified},
	}
	for _, c := range allowed {
		if !CanTransition(c[0], c[1]) {
			t.Errorf("%s to %s should be allowed", c[0], c[1])
		}
	}

	refused := [][2]domain.AlertStatus{
		{domain.AlertResolved, domain.AlertUnacknowledged},
		{domain.AlertVerified, domain.AlertResolved},
		{domain.AlertResponding, domain.AlertAcknowledged},
	}
	for _, c := range refused {
		if CanTransition(c[0], c[1]) {
			t.Errorf("%s to %s should be refused", c[0], c[1])
		}
	}
}
