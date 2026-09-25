// Command akcpsim stands in for an AKCP sensorProbe+ unit. It publishes the same topics and
// bodies the hardware does, so the subscriber, the mapping and the alert path can be exercised
// before a unit is on site.
//
//	go run ./cmd/akcpsim -broker tcp://localhost:1883 -mac 0080A3000001
//
// The MAC is the one printed on the unit, without separators. Point it at a device that exists
// in master data, or the messages land in the Integration page's unmatched list.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"math/rand/v2"
	"os"
	"os/signal"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

func main() {
	broker := flag.String("broker", "tcp://localhost:1883", "broker the unit publishes to")
	mac := flag.String("mac", "0080A3000001", "the unit's MAC, as it appears in the topic")
	every := flag.Duration("every", 5*time.Second, "how often the unit publishes")
	critical := flag.Bool("critical", false, "report HIGHCRITICAL instead of SENSORNORMAL, to open an alert")
	once := flag.Bool("once", false, "publish one round and exit")
	flag.Parse()

	if err := run(*broker, *mac, *every, *critical, *once); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(broker, mac string, every time.Duration, critical, once bool) error {
	// A random suffix keeps a one-off run from knocking the always-on demo publisher off the broker
	// when both use the same MAC: the broker allows one connection per client id.
	id := fmt.Sprintf("akcp-sim-%s-%04x", mac, rand.IntN(1<<16))
	opts := mqtt.NewClientOptions().AddBroker(broker).SetClientID(id).SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	token := client.Connect()
	token.Wait()
	if err := token.Error(); err != nil {
		return fmt.Errorf("cannot reach %s: %w", broker, err)
	}
	defer client.Disconnect(250)
	fmt.Printf("publishing as %s to %s\n", mac, broker)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	for {
		publish(client, mac, critical)
		if once {
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(every):
		}
	}
}

// publish sends one round: temperature and humidity on the two keys the probe ships with.
func publish(client mqtt.Client, mac string, critical bool) {
	temp, status := 24+rand.Float64()*2, 2
	if critical {
		temp, status = 30+rand.Float64(), 4
	}
	send(client, mac, "status_change", "0.1.0.5.0", map[string]any{
		"timestamp": time.Now().Unix(), "value": round(temp, 1), "status": status,
	})
	send(client, mac, "value_change", "0.1.0.5.1", map[string]any{
		// 50-58 %RH stays under the 60 %RH limit the demo sensors carry, so a round opens no
		// humidity alert of its own and the temperature verdict is what the alerts show.
		"timestamp": time.Now().Unix(), "value": round(50+rand.Float64()*8, 0),
	})
}

func send(client mqtt.Client, mac, event, compound string, body map[string]any) {
	topic := fmt.Sprintf("spp/%s/sensor/%s/%s", mac, event, compound)
	raw, err := json.Marshal(body)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	token := client.Publish(topic, 1, false, raw)
	token.Wait()
	if err := token.Error(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	fmt.Printf("%s %s\n", topic, raw)
}

func round(v float64, places int) float64 {
	factor := 1.0
	for range places {
		factor *= 10
	}
	return float64(int(v*factor+0.5)) / factor
}
