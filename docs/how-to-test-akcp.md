# Cara menguji konektivitas AKCP (MQTT)

Panduan ini menguji jalur perangkat AKCP sensorProbe+ ke sistem: unit mempublish ke broker
Mosquitto, API berlangganan `spp/+/sensor/+/+`, lalu menyimpan reading dan membuka atau menutup
alert. Urutannya dari yang paling cepat (tes otomatis) sampai perangkat SP1+ asli.

Semua perintah dijalankan dari root repo. Kalau Anda menjalankannya dari git worktree, tambahkan
`-p monitoring-system` setelah `docker compose` supaya memakai stack yang sama.

## 0. Prasyarat

- Docker lewat Colima, plus plugin buildx (`brew install docker-buildx`).
- Go 1.26, Node dan pnpm 9 untuk tes otomatis.
- Port yang dipakai: Postgres 5442, Mosquitto 1883, API 3300, admin 8080.

## 1. Tes otomatis

Tes unit tidak butuh database atau broker:

```bash
cd apps/api && go test ./internal/akcp/... ./internal/config/...
```

Tes integrasi menjalankan jalur MQTT terhadap Postgres sungguhan, tanpa broker. **Suite ini
menghapus isi database**, jadi muat ulang data demo sesudahnya (langkah 10).

```bash
cd apps/api && DATABASE_URL='postgres://monitoring:monitoring@localhost:5442/monitoring?sslmode=disable' go test ./...
```

Frontend (kartu MQTT di halaman Integration):

```bash
pnpm typecheck && pnpm build
```

Yang dicakup tes otomatis:

| Tes | Yang dibuktikan |
|---|---|
| `internal/akcp/message_test.go` | topik 5 level, payload dengan nilai 0 / null / tanpa timestamp, nama status 1-15, kode 17 tanpa nama |
| `internal/akcp/worker_test.go` | pesan diagnosis saat client ID bentrok |
| `internal/config/config_test.go` | client ID default `akcp-<hostname>` |
| `test/akcp_test.go` | MAC tanpa pemisah cocok ke `00:0B:DC:...`, pasangan suhu/lembap, alert dari status code tanpa duplikat, SENSORNORMAL hanya menutup alert dari kunci yang sama, kode 17, pesan yang diparkir, replay retained, binding `external_key` |

## 2. Nyalakan stack

```bash
docker compose up -d --build
```

```bash
docker compose run --rm seed
```

Pastikan subscriber tersambung:

```bash
docker compose logs api | grep "akcp subscriber connected"
```

Hasil yang diharapkan: satu baris dengan `"broker":"tcp://mosquitto:1883"` dan
`"filter":"spp/+/sensor/+/+"`. Kalau baris itu diikuti `connection lost` berulang, lihat
langkah 6.

## 2a. Perangkat demo yang jalan sendiri

Data demo membawa satu unit AKCP yang langsung hidup tanpa perintah atau tombol apa pun:

| | |
|---|---|
| Perangkat | `dev-001`, serial `SP1P-DE4001`, model AKCP sensorProbe1+ |
| Outlet | Indomaret Margorejo 1 (outlet akun demo mobile `user123@indomaret.co.id`) |
| MAC | `00:0B:DC:DE:40:01`, di topik `000BDCDE4001` |
| Sensor | `sen-001` Sales Area Temp & RH, batas 18-28 °C dan 30-60 %RH |
| Publisher | servis `akcp-demo`, tiap 30 detik, suhu 24-26 °C dan kelembapan 50-58 %RH |

Servis `akcp-demo` ikut menyala dengan `docker compose up`, jadi tidak perlu dijalankan
manual. Kalau broker mati atau belum siap, servis ini keluar lalu di-restart Docker sampai
broker kembali, kemudian lanjut mengirim.

Cek bahwa demo hidup:

```bash
docker compose exec postgres psql -U monitoring -d monitoring -c "SELECT at, temperature_c, humidity_pct FROM reading WHERE sensor_id = 'sen-001' ORDER BY at DESC LIMIT 3;"
```

Diharapkan: tiga reading berjarak sekitar 30 detik, yang terbaru kurang dari satu menit lalu.
Di admin, buka **Devices → SP1P-DE4001**: status Online, "Last push" menunjukkan "just now",
dan kartu sensor menampilkan suhu serta kelembapan terkini. Di aplikasi mobile, akun demo
melihat unit yang sama di halaman perangkat.

Unit ini juga bisa dipakai untuk memamerkan alert. Kirim satu putaran kritis:

```bash
docker compose run --rm akcp-sim -mac 000BDCDE4001 -once -critical
```

Alert `Unit reported HIGHCRITICAL` langsung terbuka, lalu publisher demo menutupnya pada
putaran berikutnya karena ia selalu melapor SENSORNORMAL. Jadi alert itu hanya terbuka sekitar
30 detik. Langkah 3 menahannya tetap terbuka dengan menghentikan demo lebih dulu.

## 3. Uji ujung ke ujung dengan simulator

Simulator (`cmd/akcpsim`) mempublish topik dan body yang sama dengan unit asli: suhu di
`0.1.0.5.0` lewat `status_change`, kelembapan di `0.1.0.5.1` lewat `value_change`. Langkah ini
memakai unit demo, jadi hentikan dulu publisher otomatisnya supaya ia tidak menutup alert yang
Anda buka:

```bash
docker compose stop akcp-demo
```

Opsional, pantau semua pesan di terminal lain:

```bash
docker compose exec mosquitto mosquitto_sub -t 'spp/#' -v
```

### 3a. Kondisi normal

```bash
docker compose run --rm akcp-sim -mac 000BDCDE4001 -once
```

```bash
docker compose exec postgres psql -U monitoring -d monitoring -c "SELECT at, temperature_c, humidity_pct FROM reading WHERE sensor_id = 'sen-001' ORDER BY at DESC LIMIT 1;"
```

Diharapkan: satu reading baru dengan suhu 24-26 °C dan kelembapan 50-58 %RH.

### 3b. Unit melapor HIGHCRITICAL

```bash
docker compose run --rm akcp-sim -mac 000BDCDE4001 -once -critical
```

```bash
docker compose exec postgres psql -U monitoring -d monitoring -c "SELECT id, status, trigger_value, message FROM alert WHERE sensor_id = 'sen-001' ORDER BY id DESC LIMIT 1;"
```

Diharapkan: alert `UNACKNOWLEDGED`, `trigger_value` sekitar 30-31 °C, pesan
`Unit reported HIGHCRITICAL`. Menjalankan `-critical` sekali lagi tidak membuka alert kedua.
Selama demo berhenti, alert ini tetap terbuka, jadi Anda bisa meresponsnya dari aplikasi mobile
(lihat [how-to-use.md](how-to-use.md)).

### 3c. Unit kembali normal

Jalankan lagi perintah 3a, lalu query alert yang sama. Diharapkan: alert tadi `RESOLVED`
dengan `clear_value` berisi suhu terakhir.

Nyalakan lagi publisher demo setelah selesai:

```bash
docker compose start akcp-demo
```

## 4. Skenario negatif dan kasus tepi

`mosquitto_pub` di dalam container broker mengirim body apa pun ke topik apa pun. Contoh:

```bash
docker compose exec mosquitto mosquitto_pub -q 1 -t 'spp/00FFFFFFFFFF/sensor/value_change/0.1.0.5.0' -m '{"value":21}'
```

| Kasus | Topik | Body | Yang diharapkan |
|---|---|---|---|
| MAC tak terdaftar | `spp/00FFFFFFFFFF/sensor/value_change/0.1.0.5.0` | `{"value":21}` | diparkir: `No enabled sensor sits behind a device with MAC "00FFFFFFFFFF"` |
| Kunci sensor tak dikenal | `spp/000BDCDE4001/sensor/value_change/9.9.9.9.9` | `{"value":22.5}` | diparkir: `Sensor key "9.9.9.9.9" is bound to no sensor on this device` |
| Body bukan JSON | `spp/000BDCDE4001/sensor/value_change/0.1.0.5.0` | `bukan json` | diparkir: `body is not JSON: ...` |
| Kode status 17 | `spp/000BDCDE4001/sensor/status_change/0.1.0.5.0` | `{"value":25.5,"status":17}` | reading tersimpan, tidak ada alert |
| Tanpa timestamp | `spp/000BDCDE4001/sensor/value_change/0.1.0.5.0` | `{"value":23}` | reading dicap waktu kedatangan |

Pesan yang diparkir:

```bash
docker compose exec postgres psql -U monitoring -d monitoring -c "SELECT at, reason, raw FROM unmatched_event WHERE source = 'akcp' ORDER BY at DESC LIMIT 5;"
```

### Binding `external_key`

Kunci yang tidak ada di registry (`0.1.0.5.0` suhu, `0.1.0.5.1` lembap) perlu diikat ke sensor.
Halaman admin belum punya form untuk ini, jadi pakai SQL:

```bash
docker compose exec postgres psql -U monitoring -d monitoring -c "UPDATE sensor SET external_key = '9.9.9.9.9' WHERE id = 'sen-001';"
```

Kirim ulang pesan kasus "kunci sensor tak dikenal" di atas. Diharapkan: reading 22.5 °C
tersimpan di `sen-001`. Lepas lagi ikatannya setelah selesai:

```bash
docker compose exec postgres psql -U monitoring -d monitoring -c "UPDATE sensor SET external_key = NULL WHERE id = 'sen-001';"
```

## 5. Cek di dashboard

Buka `http://localhost:8080`, masuk sebagai `admin@indomaret.co.id` dengan password demo
`admin123`. Setelah seed ulang, sesi lama hilang dan Anda perlu masuk lagi.

- **API Integration → Channels & settings**: kartu "AKCP sensorProbe+ → MQTT" berstatus
  `connected`, dengan broker `tcp://mosquitto:1883`, topic filter, jumlah pesan masuk dan
  tersimpan, serta waktu pesan terakhir. Tombol **Test** menjawab `Subscribed to ... N
  message(s) received`.
- **Request log**: baris kanal `akcp` untuk koneksi, alert yang dibuka atau ditutup, dan pesan
  yang ditolak. Reading biasa sengaja tidak dicatat supaya log tidak banjir.
- **Unmatched events** (di bawah request log): pesan dari langkah 4.
- **Alerts**: alert `Unit reported HIGHCRITICAL` dari langkah 3b.

## 6. Uji bentrok client ID

Broker hanya menyimpan satu sesi per client ID dan memutus koneksi lama saat klien lain datang
dengan ID yang sama. Default-nya `akcp-<hostname>`, jadi container (`akcp-monitoring-api`) dan
API lokal di laptop tidak bentrok.

Jalankan API lokal di samping container:

```bash
cd apps/api && DATABASE_URL='postgres://monitoring:monitoring@localhost:5442/monitoring?sslmode=disable' JWT_SECRET='change-me-at-least-32-characters-long-secret' WEBHOOK_SECRET='local-webhook-secret' PORT=3301 MQTT_BROKER_URL='tcp://localhost:1883' go run ./cmd/api
```

Diharapkan: kedua proses tetap tersambung, dan log broker menampilkan dua ID berbeda:

```bash
docker compose logs mosquitto | grep "New client connected"
```

Untuk memaksa bentrok, hentikan API lokal lalu jalankan ulang dengan
`MQTT_CLIENT_ID=akcp-monitoring-api` ditambahkan di depan perintahnya. Dalam beberapa detik
log container mencatat pesan seperti ini (angka detiknya bervariasi):

```text
Connection lost 4.051s after connecting (EOF). Another client may be using client id "akcp-monitoring-api"; give each instance its own MQTT_CLIENT_ID
```

Pesan yang sama tampil di kartu MQTT. Setelah API lokal dihentikan, container tersambung lagi
sendiri.

## 7. Uji dengan perangkat SP1+ asli

1. Pastikan laptop dan perangkat satu jaringan. Broker bisa dicapai di `<IP laptop>:1883`;
   `docker/mosquitto.conf` mengizinkan akses anonim untuk bench lokal.
2. Di pengaturan MQTT perangkat, arahkan broker ke IP dan port itu. Rujukan menu dan formatnya
   ada di "SP+ and WTG MQTT Manual.pdf" di repo AKCP-SP1-.
3. Daftarkan perangkat di admin (**Device Info → Add device**) dengan MAC yang tertera di unit,
   dan beri satu sensor bertipe Temperature & Humidity.
4. Pantau pesan yang masuk:

   ```bash
   docker compose exec mosquitto mosquitto_sub -t 'spp/#' -v
   ```

5. Cocokkan segmen kedua topik dengan MAC yang didaftarkan. Titik dua dan tanda hubung
   diabaikan saat pencocokan, huruf besar kecil juga.
6. Kalau compound id di segmen terakhir bukan `0.1.0.5.0` atau `0.1.0.5.1`, ikat dengan
   `external_key` seperti di langkah 4.
7. Ulangi pemeriksaan langkah 3 dan 5 dengan MAC dan sensor perangkat asli.

## 8. Koordinat outlet

Commit `685fb6e` memperbaiki koordinat outlet yang sebelumnya dekat 0,0.

```bash
docker compose exec postgres psql -U monitoring -d monitoring -c "SELECT city, count(*), min(lat), max(lat), min(lng), max(lng) FROM outlet GROUP BY city;"
```

Diharapkan: Surabaya sekitar -7.3 / 112.7, Jakarta Utara sekitar -6.1 / 106.9, Denpasar
sekitar -8.7 / 115.2. Di admin, halaman **Shopfloor** menampilkan pin di kota masing-masing,
dan link Google Maps outlet membuka lokasi yang sama.

## 9. Troubleshooting

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Build gagal `lookup proxy.golang.org ... i/o timeout` | DNS di VM Colima sesekali gagal | ulangi build; untuk permanen `colima start --dns 1.1.1.1` (me-restart semua container) |
| `BuildKit is enabled but the buildx component is missing` | plugin buildx belum terpasang | `brew install docker-buildx` |
| `connection lost` tiap beberapa detik | dua instance memakai client ID yang sama | lihat langkah 6 |
| Kartu MQTT menampilkan `no broker` | `MQTT_BROKER_URL` kosong | isi di environment API, lalu restart |
| `cannot reach tcp://localhost:1883` dari simulator di container | `docker-compose.yml` versi lama: argumen `run` menggantikan `-broker` | pakai `docker-compose.yml` terbaru, yang menaruh broker di `entrypoint` |
| Status kritis tidak membuka alert | sensor sudah punya alert terbuka (satu sensor, satu alert terbuka) | tutup alert itu dulu dari halaman Alerts |
| Alert kritis tertutup sendiri dalam 30 detik | publisher demo melapor SENSORNORMAL | `docker compose stop akcp-demo` selama menguji alert (langkah 3) |
| Pesan tidak menghasilkan reading | pesan diparkir | baca `reason` di `unmatched_event` (langkah 4) |
| Reading `sen-001` berhenti bertambah | servis `akcp-demo` tidak jalan | `docker compose ps akcp-demo` dan `docker compose logs akcp-demo`; nyalakan dengan `docker compose up -d akcp-demo` |

## 10. Kembalikan data demo

```bash
docker compose run --rm seed
```
