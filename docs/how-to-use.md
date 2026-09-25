# Cara menggunakan sistem monitoring outlet

Sistem ini memantau suhu dan kelembapan di outlet memakai unit AKCP sensorProbe1+ (SP1+). Tiap
unit mengirim pembacaan dan status lewat MQTT ke broker, API menyimpannya, lalu membuka alert
kalau kondisi keluar batas. Admin distribution center bekerja di dashboard web; karyawan outlet
dan teknisi bekerja di aplikasi mobile.

Panduan ini untuk pemakai. Untuk menguji sistem langkah demi langkah, termasuk kasus tepi, lihat
[how-to-test-akcp.md](how-to-test-akcp.md).

## Peran dan akses

| Peran | Aplikasi | Alamat (stack Docker) | Masuk dengan |
|---|---|---|---|
| Admin distribution center | Dashboard admin | http://localhost:8080 | e-mail dan password |
| Karyawan outlet | Aplikasi mobile (PWA) | http://localhost:8081 | e-mail dan token pendaftaran |
| Teknisi | Aplikasi mobile (PWA) | http://localhost:8081 | e-mail dan token pendaftaran |

Akun demo Surabaya: admin `admin@indomaret.co.id` / `admin123`, karyawan
`user123@indomaret.co.id` / token `9634871231`, teknisi `tech@wit.id` / token `2468013579`. Akun
Jakarta Utara dan Denpasar ada di README. Semua kredensial ini tercantum di repository, jadi ganti
password admin dan terbitkan token baru sebelum sistem dipakai orang sungguhan.

## 1. Menyalakan sistem

```bash
docker compose up -d --build
```

Untuk mengisi data demo (30 outlet dan satu unit AKCP yang langsung mengirim data):

```bash
docker compose run --rm seed
```

Tanpa data demo, database hanya berisi tiga distribution center, akun admin, dan akun mobile
contoh. Unit dan tipe perangkat Anda tambahkan sendiri lewat langkah 2 dan 3.

## 2. Admin: menyiapkan distribution center

Buka **Settings → Setup Wizard**. Wizard memandu lima langkah:

1. **Distribution center**: nama, kode, kota, alamat.
2. **Outlets**: satu baris per outlet (kode dan nama).
3. **AKCP units**: pilih model dan sensor per outlet. SP1+ punya satu port digital untuk satu
   probe Temperature & Humidity.
4. **Employees**: karyawan per outlet.
5. **Integration**: menampilkan broker dan topik MQTT yang dipakai API, serta saklar broadcast
   Telegram.

Tekan **Finish setup** untuk membuat semuanya. Wizard memberi setiap unit MAC sementara. Ganti
dengan MAC asli unit lewat langkah 3.5 sebelum unit dihubungkan ke broker.

## 3. Admin: mendaftarkan unit AKCP

1. Buka **Assets → Device Types** dan pastikan model **AKCP sensorProbe1+** ada. Data demo sudah
   membawanya. Pada instalasi baru, tekan **Add device type**: model `SP1+`, vendor `AKCP`, satu
   port digital, tanpa sensor bawaan.
2. Buka **Assets → Devices**, lalu tekan **Add device**.
3. Isi **Outlet**, **Model**, **Serial**, **MAC address**, dan **IP address**. Salin MAC dari
   label unit. Format apa pun diterima (`000BDC123456`, `00-0B-DC-12-34-56`, atau
   `00:0B:DC:12:34:56`), dan sistem menyimpannya sebagai `00:0B:DC:12:34:56`. MAC ini penting:
   pesan MQTT dari unit dicocokkan ke perangkat lewat MAC tersebut.
4. Biarkan **Sales Area Temp & RH** menyala di **Sensors to install**, lalu tekan
   **Register device**.
5. Untuk mengubah serial atau MAC nanti, tekan ikon pensil di baris perangkat pada halaman
   Devices, atau **Edit device** di halaman perangkat. Sistem menolak MAC atau serial yang sudah
   dipakai perangkat lain.

### Batas sensor

Setiap sensor punya batas sendiri. Nilai awalnya 18-28 °C dan 30-60 %RH. Untuk mengubahnya, buka
halaman perangkat, cari bagian **Sensors**, tekan **Edit sensor**, lalu isi **Lower °C**,
**Upper °C**, **Lower %RH**, dan **Upper %RH**. Batas bawah tidak boleh di atas batas atas.

### Posisi di denah

Di halaman perangkat, bagian **Shopfloor position** menampilkan unit dan sensornya di denah
outlet. Tekan **Move unit** atau salah satu titik di **Installation points** untuk memindahkan
posisinya. Halaman **Operations → Shopfloor** menampilkan peta semua outlet sekaligus.

## 4. Menghubungkan unit fisik ke broker

1. Hubungkan unit ke jaringan yang bisa menjangkau mesin tempat stack berjalan.
2. Di pengaturan MQTT pada unit, isi broker dengan alamat IP mesin itu dan port `1883`. Menu
   persisnya ada di "SP+ and WTG MQTT Manual" dari AKCP. Unit mempublish ke
   `spp/<MAC>/sensor/<status_change|value_change>/<kunci sensor>`, dan API berlangganan
   `spp/+/sensor/+/+`.
3. Buka **Settings → Integration**. Kartu **AKCP sensorProbe+ → MQTT** harus berstatus
   `connected`, dan angka **Messages** bertambah begitu unit mengirim. Tombol **Test** di kartu
   itu menjawab status koneksi dan jumlah pesan.
4. Di halaman perangkat, **Last push** menunjukkan "just now" dan kartu sensor menampilkan suhu
   serta kelembapan terkini.

Kalau pesan tidak mendarat di perangkat, buka tab **Request log**. Bagian **Unmatched events**
di bawahnya menyebut alasannya:

| Alasan | Artinya | Perbaikan |
|---|---|---|
| `No enabled sensor sits behind a device with MAC ...` | MAC di topik tidak cocok dengan perangkat mana pun | samakan MAC perangkat dengan label unit (langkah 3.5) |
| `Sensor key ... is bound to no sensor on this device` | unit memakai kunci sensor selain `0.1.0.5.0` (suhu) dan `0.1.0.5.1` (kelembapan) | ikat kunci itu ke sensor; caranya ada di how-to-test-akcp.md langkah 4 |
| `body is not JSON` | isi pesan rusak | periksa pengaturan MQTT pada unit |

## 5. Admin: memantau

- **Dashboard**: tampilan **Operations** berisi antrean yang perlu ditangani (alert yang menunggu
  respons, perangkat offline, tiket terlambat, akun yang menunggu persetujuan) dan outlet
  unggulan dengan pembacaan live. Tampilan **Maintenance** berisi kesehatan perangkat.
- **Operations → Alerts**: semua alert, bisa difilter per outlet dan kategori.
- **Operations → Shopfloor**: peta outlet dan denah dalam toko.
- **Insights → Analysis**: tren suhu dan kelembapan.
- **Insights → Reports**: laporan yang bisa diekspor ke CSV.

## 6. Alert: dari mana datangnya dan cara menanganinya

Sistem membuka alert dalam dua keadaan:

- **Unit melapor kondisi bermasalah**: HIGHWARNING, HIGHCRITICAL, LOWWARNING, LOWCRITICAL,
  SENSORERROR, STATUS_OFFLINE, atau UNREACHABLE. Alert tampil sebagai
  "Unit reported HIGHCRITICAL" dan seterusnya.
- **Pembacaan keluar batas sensor**, misalnya "Temperature above the 28.0 °C limit".

Satu sensor hanya punya satu alert terbuka, jadi unit yang terus mengirim tidak membanjiri
outlet. Alert tertutup sendiri saat unit melapor normal lagi atau pembacaan kembali ke dalam
batas.

### Karyawan: merespons di aplikasi mobile

1. Buka tab **Alerts**. Pilih outlet di baris atas, lalu tab status (**New**, **Acknowledged**,
   **Responding**, dan seterusnya).
2. Buka alert. Layar menampilkan tenggat respons (15 menit untuk alert suhu dan kelembapan),
   lokasi, unit, sensor, dan pembacaan terakhir. **Call manager** menelepon manajer outlet, dan
   **Directions** membuka Google Maps.
3. Tekan **Acknowledge alert**. Anda tercatat sebagai penanggung jawab, dan karyawan lain di
   outlet yang sama tidak bisa mengambil alert itu.
4. Tekan **Start site inspection**, lalu periksa lokasi sensor.
5. Isi **Notes** dengan temuan Anda. Tambahkan foto lewat **Camera** atau **Browse Photo**.
6. Tekan **Submit response**. Alert berstatus **Resolved**.

### Admin: memverifikasi

Buka alert di **Operations → Alerts**. Setelah karyawan mengirim respons, panel alert menampilkan
**Field response** (catatan dan foto). Tekan **Verify resolution** untuk menutupnya secara resmi.
Admin juga bisa menekan **Mark resolved** tanpa respons lapangan.

## 7. Admin: akun karyawan dan teknisi

**Karyawan**, di **People → User Management**:

1. Tekan **Add employee**, isi data, dan pilih outletnya. Karyawan baru berstatus pending dan
   belum bisa masuk.
2. Tekan **Approve** untuk mengaktifkannya.
3. Buka **Show token** untuk melihat token pendaftaran, lalu berikan e-mail dan token itu ke
   karyawan. Karyawan masuk di aplikasi mobile lewat kolom **Email** dan **Token**.
4. **Generate new token** mengganti token lama. **Revoke access** menghapus token dan
   mengembalikan akun ke pending, jadi karyawan itu tidak bisa masuk lagi.

**Teknisi**, di **Assets → Maintenance**, tab **Technicians**: tekan **Add technician**. Teknisi
juga masuk di aplikasi mobile dengan e-mail dan token.

## 8. Maintenance dan tiket

**Admin**, di **Assets → Maintenance**: tab **Hardware health**, **Tickets**, **Schedule**, dan
**Technicians**. Tekan **New ticket** untuk membuat tiket dan menugaskan teknisi.

**Teknisi**, di tab **Maintenance** aplikasi mobile. Tab **Mine** berisi tiket Anda, **All open**
berisi semua tiket terbuka, dan **Done** berisi yang sudah selesai.

1. Buka tiket. Kalau tiket belum punya teknisi, tekan **Assign to me**. Tiket milik teknisi lain
   tidak bisa diambil alih dari aplikasi; minta admin memindahkannya.
2. Tekan **Start work** saat mulai bekerja. Status tiket menjadi In progress.
3. Tekan **Complete ticket**. Di **Completion report**, isi **Work notes** (wajib) dan tambahkan
   foto bila perlu, lalu tekan **Mark done**.

**Karyawan** melaporkan kerusakan di tab **Maintenance**: tekan **Report a hardware issue**, pilih
**Priority**, lalu **Submit ticket**.

## 9. Notifikasi

Di **Settings → Integration**, saklar **Mobile push (ANITS app)** dan **Telegram broadcast
(ANBot)** mengatur kanal notifikasi. Tekan **Save settings** setelah mengubahnya. Klien push dan
bot Telegram belum dibangun: sistem mencatat notifikasinya, dan tombol **Test** kedua kanal itu
menjawab bahwa kliennya belum ada.

## 10. Demo tanpa perangkat

Data demo membawa satu unit, **SP1P-DE4001** di Indomaret Margorejo 1. Servis `akcp-demo` mengirim
data sebagai unit itu setiap 30 detik sejak `docker compose up`, jadi dashboard dan aplikasi
mobile menampilkan data live tanpa ada yang menekan apa pun.

Untuk memperlihatkan alur alert, hentikan dulu publisher demo supaya alert tidak tertutup
otomatis, lalu kirim satu putaran kritis:

```bash
docker compose stop akcp-demo
```

```bash
docker compose run --rm akcp-sim -mac 000BDCDE4001 -once -critical
```

Alert "Unit reported HIGHCRITICAL" muncul di aplikasi mobile akun demo dan di dashboard. Setelah
selesai, nyalakan lagi demonya:

```bash
docker compose start akcp-demo
```

## Masalah umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Kartu MQTT menampilkan `no broker` | `MQTT_BROKER_URL` kosong di environment API | isi, lalu restart API |
| Kartu MQTT `disconnected` dengan pesan client id | dua instance API memakai client id yang sama | beri tiap instance `MQTT_CLIENT_ID` sendiri |
| Unit tidak pernah muncul online | MAC perangkat tidak sama dengan label unit | perbaiki lewat edit perangkat (langkah 3.5) |
| **Add device** meminta membuat tipe perangkat dulu | belum ada tipe perangkat | buat **AKCP sensorProbe1+** di Device Types (langkah 3.1) |
| Alert kritis di unit demo hilang dalam 30 detik | publisher demo selalu melapor normal | `docker compose stop akcp-demo` selama demo alert |
| Karyawan tidak bisa merespons alert | alert sudah diambil karyawan lain | lihat penanggung jawabnya di detail alert |
