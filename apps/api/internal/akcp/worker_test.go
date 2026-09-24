package akcp

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestLostReasonNamesAClientIDClash(t *testing.T) {
	eof := errors.New("EOF")

	// The broker handed our id to another client right after we connected.
	quick := lostReason(eof, 2*time.Second, "akcp-monitoring-api")
	if !strings.Contains(quick, `client id "akcp-monitoring-api"`) || !strings.Contains(quick, "MQTT_CLIENT_ID") {
		t.Errorf("a drop two seconds after connecting reads %q", quick)
	}

	// An hour of uptime then a drop is a network fault, not a clash.
	if late := lostReason(eof, time.Hour, "akcp-monitoring-api"); late != "Connection lost: EOF" {
		t.Errorf("a drop after an hour reads %q", late)
	}
}
