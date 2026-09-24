package config

import "testing"

func TestClientIDForNamesTheMachine(t *testing.T) {
	for host, want := range map[string]string{
		"Syabans-MacBook-Pro.local": "akcp-Syabans-MacBook-Pro", // a laptop running pnpm dev:api
		"monitoring-api":            "akcp-monitoring-api",      // the compose container
		"3f2a9c1b77de":              "akcp-3f2a9c1b77de",        // a container without a hostname
		"build_agent":               "akcp-build-agent",         // characters a broker may refuse
		"":                          "akcp-ingestor",
	} {
		if got := clientIDFor(host); got != want {
			t.Errorf("clientIDFor(%q) = %q, want %q", host, got, want)
		}
	}
}
