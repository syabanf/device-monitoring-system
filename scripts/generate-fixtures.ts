/* eslint-disable no-console */
// One-time seeded fixture generator. Run: pnpm gen:fixtures
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------- PRNG ----------
const SEED = 20260907;
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const rint = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (p: number) => rnd() < p;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

// ---------- time ----------
const TZ_OFFSET_MS = 7 * 3600 * 1000;
const FIXTURE_NOW = '2026-09-07T13:30:00+07:00';
const NOW = Date.parse(FIXTURE_NOW);
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
function iso(ms: number): string {
  const d = new Date(ms + TZ_OFFSET_MS);
  return d.toISOString().replace(/\.\d{3}Z$/, '+07:00');
}
function localHour(ms: number): number {
  return new Date(ms + TZ_OFFSET_MS).getUTCHours();
}
function startOfLocalDay(ms: number): number {
  const d = new Date(ms + TZ_OFFSET_MS);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - TZ_OFFSET_MS;
}

// ---------- word lists ----------
const FIRST = ['Budi','Siti','Agus','Dewi','Rizky','Putri','Andi','Ayu','Dimas','Rina','Fajar','Nur','Hendra','Lestari','Yusuf','Intan','Bayu','Maya','Eko','Sari','Rudi','Wulan','Arif','Dian','Teguh','Fitri','Adi','Ratna','Joko','Mega'];
const LAST = ['Santoso','Wijaya','Pratama','Saputra','Kusuma','Hidayat','Nugroho','Rahayu','Setiawan','Purnama','Susanto','Firmansyah','Halim','Anggraini','Permata','Mahendra','Utami','Gunawan','Sulistyo','Ramadhan'];
const AVATAR = ['#9b1c1c','#1d4ed8','#047857','#b45309','#6d28d9','#0e7490','#be185d','#4d7c0f'];

interface CityDef { city: string; province: string; lat: number; lng: number; streets: string[]; areaCode: string; }
const CITIES: Record<string, CityDef> = {
  SBY: { city: 'Surabaya', province: 'Jawa Timur', lat: -7.2575, lng: 112.7521, areaCode: '031', streets: ['Margorejo','Rungkut','Ketintang','Wiyung','Gubeng','Ngagel','Kertajaya','Mulyosari','Tenggilis','Dukuh Kupang','Manukan','Kenjeran','Sukolilo','Darmo','Jemursari','Kupang Jaya','Semolowaru','Wonokromo','Bratang','Menanggal'] },
  JKT: { city: 'Jakarta Utara', province: 'DKI Jakarta', lat: -6.1214, lng: 106.8766, areaCode: '021', streets: ['Permata Intan','Tugu Selatan','Kelapa Gading','Sunter','Tanjung Priok'] },
  DPS: { city: 'Denpasar', province: 'Bali', lat: -8.6705, lng: 115.2126, areaCode: '0361', streets: ['Gatot Subroto','Teuku Umar','Sesetan','Renon','Sanur'] },
};

// ---------- output containers ----------
const distributors: any[] = [];
const outlets: any[] = [];
const deviceTypes: any[] = [];
const devices: any[] = [];
const sensors: any[] = [];
const employees: any[] = [];
const contactPersons: any[] = [];
const adminUsers: any[] = [];
const alerts: any[] = [];
const readings: any[] = [];

const pad = (n: number, w = 3) => String(n).padStart(w, '0');
const phone = () => `08${rint(11, 99)}${pad(rint(0, 9999), 4)}${pad(rint(0, 9999), 4)}`;
const token = () => String(rint(1_000_000_000, 9_999_999_999));

// ---------- distributors + admins ----------
const DIST = [
  { id: 'dst-sby', code: 'DC-SBY', name: 'Distribution Center Surabaya', cityKey: 'SBY', admin: { name: 'Dewi Anggraini', email: 'admin@indomaret.co.id' } },
  { id: 'dst-jkt', code: 'DC-JKT', name: 'Distribution Center Jakarta Utara', cityKey: 'JKT', admin: { name: 'Hendra Wijaya', email: 'admin.jkt@indomaret.co.id' } },
  { id: 'dst-dps', code: 'DC-DPS', name: 'Distribution Center Denpasar', cityKey: 'DPS', admin: { name: 'Putu Mahendra', email: 'admin.dps@indomaret.co.id' } },
];
DIST.forEach((d, i) => {
  const c = CITIES[d.cityKey]!;
  const adminId = `adm-${pad(i + 1)}`;
  adminUsers.push({ id: adminId, distributorId: d.id, name: d.admin.name, email: d.admin.email, role: 'admin', avatarColor: AVATAR[i]! });
  distributors.push({ id: d.id, code: d.code, name: d.name, region: c.province, city: c.city, address: `Jl. Raya Industri No. ${rint(1, 99)}, ${c.city}`, adminUserId: adminId });
});

// ---------- device types ----------
deviceTypes.push({ id: 'dt-sp1p', model: 'SP1+', name: 'AKCP sensorProbe1+', vendor: 'AKCP', ports: [{ kind: 'digital', count: 1 }], builtInSensors: [], description: 'Single-port sensorProbe with an intelligent temperature and humidity probe. Publishes every reading and status change over MQTT on spp/<mac>/sensor/<event>/<key>.', priceIdr: 0, latestFirmware: 'v1.0.0', maintenanceIntervalDays: 180 });

// ---------- outlets ----------
const OUTLET_PLAN: Array<{ dist: string; cityKey: string; count: number }> = [
  { dist: 'dst-sby', cityKey: 'SBY', count: 20 },
  { dist: 'dst-jkt', cityKey: 'JKT', count: 5 },
  { dist: 'dst-dps', cityKey: 'DPS', count: 5 },
];
let outletN = 0;
for (const plan of OUTLET_PLAN) {
  const c = CITIES[plan.cityKey]!;
  for (let i = 0; i < plan.count; i++) {
    outletN++;
    const street = c.streets[i % c.streets.length]!;
    const suffix = Math.floor(i / c.streets.length) + 1;
    const lat = round5(c.lat + (rnd() - 0.5) * 0.12);
    const lng = round5(c.lng + (rnd() - 0.5) * 0.12);
    outlets.push({
      id: `out-${pad(outletN)}`,
      distributorId: plan.dist,
      code: `IDM-${plan.cityKey}-${pad(i + 1, 4)}`,
      name: `Indomaret ${street} ${suffix}`,
      address: `Jl. ${street} No. ${rint(1, 180)}, ${c.city}, ${c.province}`,
      city: c.city,
      province: c.province,
      lat, lng,
      mapsUrl: `https://maps.google.com/?q=${lat},${lng}`,
      openTime: '07:00',
      closeTime: '22:00',
      timezone: plan.cityKey === 'DPS' ? 'Asia/Makassar' : 'Asia/Jakarta',
      phone: `${c.areaCode}-${rint(3000000, 8999999)}`,
    });
  }
}

// ---------- devices + sensors ----------
// One AKCP sensorProbe1+ at Indomaret Margorejo 1, where the demo employee works, so the dashboard
// and the mobile app both show a unit that reports over MQTT. The akcp-demo service in
// docker-compose publishes as this MAC every 30 seconds, so the unit stays live with nobody
// pressing anything.
{
  const outlet = outlets[0]!;
  const installedAt = NOW - 170 * DAY; // the semi-annual check falls due in ten days
  devices.push({
    id: 'dev-001', outletId: outlet.id, deviceTypeId: 'dt-sp1p', model: 'SP1+', serial: 'SP1P-DE4001',
    mac: '00:0B:DC:DE:40:01', // published in topics as 000BDCDE4001
    ip: '192.168.10.51', firmware: 'v1.0.0', status: 'online', lastPushAt: iso(NOW), installedAt: iso(installedAt), pushIntervalSec: 30,
    ports: [{ index: 1, kind: 'digital', label: 'Digital 1', sensorId: 'sen-001' }], channels: ['app'], warrantyUntil: iso(installedAt + 365 * DAY),
    lastMaintenanceAt: null, nextMaintenanceAt: iso(installedAt + 180 * DAY), uptimePct: 99.8, sensorFaults: 0, floor: { x: 91, y: 60 },
  });
  sensors.push({ id: 'sen-001', deviceId: 'dev-001', outletId: outlet.id, name: 'Sales Area Temp & RH', type: 'TEMPERATURE_HUMIDITY', portKind: 'digital', portIndex: 1, unit: '°C', enabled: true, floor: { x: 50, y: 52 }, thresholds: { min: 18, max: 28, humidityMin: 30, humidityMax: 60 } });
}

// ---------- employees ----------
let empN = 0;
const ROLES = ['store_manager', 'assistant_manager', 'cashier', 'cashier', 'staff'];
for (const o of outlets) {
  for (let i = 0; i < 5; i++) {
    empN++;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const pending = chance(0.15);
    employees.push({
      id: `emp-${pad(empN)}`,
      distributorId: o.distributorId,
      outletIds: [o.id],
      primaryOutletId: o.id,
      name,
      phone: phone(),
      email: `${name.toLowerCase().replace(/\s+/g, '.')}${empN}@indomaret.co.id`,
      role: ROLES[i],
      registrationToken: token(),
      registrationStatus: pending ? 'pending' : 'approved',
      registeredAt: iso(NOW - rint(1, 120) * DAY),
      approvedAt: pending ? null : iso(NOW - rint(0, 100) * DAY),
      avatarColor: pick(AVATAR),
    });
  }
}
// demo employee on two Surabaya outlets
const demoEmployee = {
  id: 'emp-demo',
  distributorId: 'dst-sby',
  outletIds: ['out-001', 'out-002'],
  primaryOutletId: 'out-001',
  name: 'Rizky Pratama',
  phone: '081234567890',
  email: 'user123@indomaret.co.id',
  role: 'store_manager',
  registrationToken: '9634871231',
  registrationStatus: 'approved',
  registeredAt: iso(NOW - 45 * DAY),
  approvedAt: iso(NOW - 44 * DAY),
  avatarColor: '#9b1c1c',
};
employees.unshift(demoEmployee);
// The sign-ins migration 0004 seeds and the README lists, pinned so `pnpm db:seed` loads the same
// accounts whatever the random draws above produced.
const PINNED_EMPLOYEES: Record<string, object> = {
  'emp-101': { name: 'Dewi Kusuma', phone: '086063424748', email: 'dewi.kusuma101@indomaret.co.id', registrationToken: '5519965858', avatarColor: '#4d7c0f' },
  'emp-136': { name: 'Dian Gunawan', phone: '083212810675', email: 'dian.gunawan136@indomaret.co.id', registrationToken: '3553120696', avatarColor: '#be185d' },
};
for (const e of employees) {
  const pinned = PINNED_EMPLOYEES[e.id];
  if (pinned) Object.assign(e, pinned, { role: 'store_manager', registrationStatus: 'approved', approvedAt: e.approvedAt ?? e.registeredAt });
}

// ---------- contact persons ----------
let cpN = 0;
for (const o of outlets) {
  for (const [role, primary] of [['Area Supervisor', true], ['Field Coordinator', false]] as const) {
    cpN++;
    contactPersons.push({ id: `cp-${pad(cpN)}`, outletId: o.id, name: `${pick(FIRST)} ${pick(LAST)}`, phone: phone(), email: chance(0.7) ? `korlap${cpN}@indomaret.co.id` : null, role, isPrimary: primary, channels: chance(0.6) ? ['app', 'telegram'] : ['app'] });
  }
}

// ---------- alerts ----------
const sensorsByOutlet = new Map<string, any[]>();
for (const s of sensors) sensorsByOutlet.set(s.outletId, [...(sensorsByOutlet.get(s.outletId) ?? []), s]);
const employeesByOutlet = new Map<string, any[]>();
for (const e of employees) for (const oid of e.outletIds) employeesByOutlet.set(oid, [...(employeesByOutlet.get(oid) ?? []), e]);

function makeAlert(outlet: any, triggerMs: number) {
  const sensor = pick(sensorsByOutlet.get(outlet.id)!);
  const category = 'COMFORT';
  let triggerValue: string, clearValue: string, message: string;
  if (chance(0.7)) {
    const v = round2(28 + rnd() * 5);
    triggerValue = `${v.toFixed(2)} °C`; clearValue = `${round2(25 + rnd() * 2.5).toFixed(2)} °C`; message = 'Temperature above 28.00 °C';
  } else {
    const v = round2(61 + rnd() * 14);
    triggerValue = `${v.toFixed(1)} %RH`; clearValue = `${round2(50 + rnd() * 8).toFixed(1)} %RH`; message = 'Humidity above 60.0 %RH';
  }
  const age = NOW - triggerMs;
  let status: string;
  if (age < 2 * DAY) { const r = rnd(); status = r < 0.45 ? 'TRIGGERED' : r < 0.8 ? 'RESPONDED' : 'CLEARED'; }
  else status = 'CLEARED';

  let response: any = null;
  let clearTime: number | null = null;
  const responders = (employeesByOutlet.get(outlet.id) ?? []).filter((e) => e.registrationStatus === 'approved');
  if (status !== 'TRIGGERED' && !(status === 'CLEARED' && chance(0.05))) {
    const durSec = Math.round((2 + Math.pow(rnd(), 2) * 88) * 60);
    const respondedAt = triggerMs + durSec * 1000;
    if (respondedAt < NOW) {
      const emp = pick(responders);
      const notes = pick([
        'Checked the area, AC unit restarted. Temperature normalising.',
        'Chiller door left open during restock. Closed it, temperature dropping.',
        'Cooler area humid after mopping, ventilation turned on.',
        'Verified on site, no anomaly found. Probe cable re-seated.',
      ]);
      response = { employeeId: emp.id, notes, photoUrls: chance(0.35) ? [`photos/proof-0${rint(1, 3)}.svg`] : [], respondedAt: iso(respondedAt), responseDurationSec: durSec };
    } else if (status === 'RESPONDED') status = 'TRIGGERED';
  }
  if (status === 'CLEARED') {
    clearTime = triggerMs + rint(15, 360) * MIN;
    if (response) clearTime = Math.max(clearTime, Date.parse(response.respondedAt) + rint(5, 60) * MIN);
    if (clearTime >= NOW) { status = response ? 'RESPONDED' : 'TRIGGERED'; clearTime = null; }
  }
  alerts.push({
    id: 0,
    distributorId: outlet.distributorId,
    outletId: outlet.id,
    deviceId: sensor.deviceId,
    sensorId: sensor.id,
    sensorName: sensor.name,
    sensorType: sensor.type,
    category,
    status,
    triggerValue,
    triggerTime: iso(triggerMs),
    clearValue: clearTime ? clearValue : null,
    clearTime: clearTime ? iso(clearTime) : null,
    message,
    response,
    channels: chance(0.6) ? ['app', 'telegram'] : ['app'],
  });
}
const todayStart = startOfLocalDay(NOW);
for (const o of outlets.filter((x) => sensorsByOutlet.has(x.id))) {
  for (let d = 29; d >= 0; d--) {
    const dayStart = todayStart - d * DAY;
    const r = rnd();
    const n = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const t = dayStart + rint(0, 24 * 60 - 1) * MIN;
      if (t < NOW - 5 * MIN) makeAlert(o, t);
    }
  }
}

alerts.sort((a, b) => Date.parse(a.triggerTime) - Date.parse(b.triggerTime));
alerts.forEach((a, i) => (a.id = 5723509 + i));

// ---------- readings (hourly, 7 days, temp/RH sensors) ----------
const comfortAlerts = alerts.filter((a) => a.category === 'COMFORT');
for (const s of sensors.filter((x) => x.type === 'TEMPERATURE_HUMIDITY')) {
  const baseT = 23.5 + rnd() * 2;
  const baseH = 48 + rnd() * 8;
  const mine = comfortAlerts.filter((a) => a.sensorId === s.id).map((a) => ({ t: Date.parse(a.triggerTime), v: parseFloat(a.triggerValue), hum: a.triggerValue.includes('%') }));
  const start = NOW - 7 * DAY;
  for (let t = start; t <= NOW; t += HOUR) {
    const h = localHour(t);
    const diurnal = Math.sin(((h - 8) / 24) * Math.PI * 2);
    let temp = baseT + 2.2 * diurnal + (rnd() - 0.5) * 0.8;
    let hum = baseH - 6 * diurnal + (rnd() - 0.5) * 3;
    for (const a of mine) {
      const dt = Math.abs(t - a.t);
      if (dt <= 90 * MIN) {
        const w = 1 - dt / (90 * MIN);
        if (a.hum) hum = hum + (a.v - hum) * w; else temp = temp + (a.v - temp) * w;
      }
    }
    readings.push([s.id, iso(t), round2(temp), round2(hum)]);
  }
}

// ---------- technicians ----------
const technicians: any[] = [];
let techN = 0;
for (const d of DIST) {
  for (const spec of ['AKCP hardware', 'Network & connectivity', 'Sensor calibration']) {
    techN++;
    const tname = `${pick(FIRST)} ${pick(LAST)}`;
    technicians.push({ id: `tech-${pad(techN)}`, distributorId: d.id, name: tname, phone: phone(), specialty: spec, avatarColor: pick(AVATAR), email: `${tname.toLowerCase().replace(/\s+/g, '.')}@wit.id`, registrationToken: token() });
  }
}
// The technician sign-ins migration 0004 seeds and the README lists, pinned like the employees.
const PINNED_TECHNICIANS: Record<string, object> = {
  'tech-001': { name: 'Andi Saputra', phone: '086811216865', avatarColor: '#6d28d9', email: 'tech@wit.id', registrationToken: '2468013579' },
  'tech-004': { name: 'Eko Purnama', phone: '086711176657', avatarColor: '#9b1c1c', email: 'eko.purnama@wit.id', registrationToken: '6893220859' },
  'tech-007': { name: 'Intan Pratama', phone: '089516427089', avatarColor: '#4d7c0f', email: 'intan.pratama@wit.id', registrationToken: '4589475365' },
};
for (const t of technicians) Object.assign(t, PINNED_TECHNICIANS[t.id] ?? {});
const techsByDist = new Map<string, any[]>();
for (const t of technicians) techsByDist.set(t.distributorId, [...(techsByDist.get(t.distributorId) ?? []), t]);

// ---------- maintenance tickets ----------
const tickets: any[] = [];
let tkN = 0;
function addTicket(dev: any, type: string, priority: string, status: string, title: string, description: string, opts: { createdAgoDays?: number; scheduledInDays?: number | null; sensorId?: string | null; parts?: string[]; notes?: string | null } = {}) {
  tkN++;
  const outlet = outlets.find((o) => o.id === dev.outletId)!;
  const createdAt = NOW - (opts.createdAgoDays ?? rint(1, 40)) * DAY - rint(0, 600) * MIN;
  const scheduledAt = opts.scheduledInDays === null ? null : createdAt + ((opts.scheduledInDays ?? rint(1, 14)) * DAY);
  const completedAt = status === 'DONE' && scheduledAt ? scheduledAt + rint(1, 5) * HOUR : null;
  const techs = techsByDist.get(outlet.distributorId)!;
  tickets.push({
    id: `MT-${String(2600 + tkN)}`,
    distributorId: outlet.distributorId,
    outletId: outlet.id,
    deviceId: dev.id,
    sensorId: opts.sensorId ?? null,
    type, priority, status, title, description,
    technicianId: status === 'OPEN' && chance(0.5) ? null : pick(techs).id,
    createdAt: iso(createdAt),
    scheduledAt: scheduledAt ? iso(Math.min(scheduledAt, status === 'DONE' ? NOW - HOUR : scheduledAt)) : null,
    completedAt: completedAt ? iso(Math.min(completedAt, NOW - 30 * MIN)) : null,
    partsUsed: opts.parts ?? [],
    notes: opts.notes ?? null,
    photoUrls: status === 'DONE' && chance(0.3) ? [`photos/proof-0${rint(1, 3)}.svg`] : [],
  });
}
for (const dev of devices) {
  const dt = deviceTypes.find((d) => d.id === dev.deviceTypeId)!;
  const devSensors = sensors.filter((s) => s.deviceId === dev.id);
  // offline devices -> corrective ticket
  if (dev.status === 'offline') {
    addTicket(dev, 'CORRECTIVE', 'CRITICAL', chance(0.5) ? 'OPEN' : 'IN_PROGRESS', 'Device offline – no push status', `${dev.serial} stopped pushing status ${Math.round((NOW - Date.parse(dev.lastPushAt)) / HOUR)} hours ago. Check power adaptor and outlet switch hub uplink.`, { createdAgoDays: rint(0, 1), scheduledInDays: 1 });
  }
  // outdated firmware -> firmware ticket
  if (dev.firmware !== dt.latestFirmware) {
    addTicket(dev, 'FIRMWARE', 'LOW', chance(0.6) ? 'OPEN' : 'SCHEDULED', `Firmware ${dev.firmware} → ${dt.latestFirmware}`, 'Download the latest firmware from AKCP support and flash the unit during operational hours.', { createdAgoDays: rint(2, 20), scheduledInDays: rint(3, 21) });
  }
  // sensor fault -> replacement
  if (dev.sensorFaults) {
    const s = pick(devSensors);
    addTicket(dev, 'REPLACEMENT', 'HIGH', pick(['OPEN', 'SCHEDULED', 'IN_PROGRESS']), `Replace ${s.name}`, `${s.name} reports intermittent readings. Replace the ${s.type === 'TEMPERATURE_HUMIDITY' ? 'digital temp & RH cable' : 'switch sensor contact'} and re-seat the port.`, { sensorId: s.id, createdAgoDays: rint(1, 10), scheduledInDays: rint(1, 10), parts: [s.type === 'TEMPERATURE_HUMIDITY' ? 'Digital Temperature & Humidity Sensor' : 'NC switch sensor'] });
  }
  // overdue / upcoming preventive
  const nextMs = Date.parse(dev.nextMaintenanceAt);
  if (nextMs < NOW + 30 * DAY) {
    addTicket(dev, 'PREVENTIVE', nextMs < NOW ? 'MEDIUM' : 'LOW', nextMs < NOW ? 'OPEN' : 'SCHEDULED', 'Semi-annual preventive check', 'Clean the unit and the probe, verify the readings against a reference thermometer, and confirm the unit still publishes to the MQTT broker.', { createdAgoDays: rint(1, 5), scheduledInDays: Math.max(1, Math.round((nextMs - NOW) / DAY)) });
  }
  // history: completed tickets
  if (dev.lastMaintenanceAt) {
    addTicket(dev, 'PREVENTIVE', 'LOW', 'DONE', 'Semi-annual preventive check', 'Routine inspection and calibration completed.', { createdAgoDays: Math.round((NOW - Date.parse(dev.lastMaintenanceAt)) / DAY) + 3, scheduledInDays: 3, notes: pick(['All sensors within tolerance. Cleaned dust from unit.', 'Re-seated door switch cable, readings stable.', 'Replaced power adaptor as precaution, unit healthy.']) });
  }
  if (chance(0.3)) addTicket(dev, 'CORRECTIVE', 'MEDIUM', 'DONE', 'Intermittent network connection', 'Device dropped off the network several times a day.', { createdAgoDays: rint(20, 120), scheduledInDays: 2, notes: 'Replaced patch cable to the outlet switch hub.', parts: ['Cat6 patch cable 3m'] });
}

// ---------- write ----------
const outDir = join(process.cwd(), 'packages/fixtures/data');
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown, pretty = true) => writeFileSync(join(outDir, `${name}.json`), pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
write('meta', { seed: SEED, fixtureNow: FIXTURE_NOW, generatedAt: new Date().toISOString() });
write('distributors', distributors);
write('outlets', outlets);
write('device-types', deviceTypes);
write('devices', devices);
write('sensors', sensors);
write('employees', employees);
write('contact-persons', contactPersons);
write('admin-users', adminUsers);
write('alerts', alerts);
write('readings', readings, false);
write('technicians', technicians);
write('maintenance-tickets', tickets);

console.log({ distributors: distributors.length, outlets: outlets.length, devices: devices.length, sensors: sensors.length, employees: employees.length, contactPersons: contactPersons.length, alerts: alerts.length, open: alerts.filter((a) => a.status === 'TRIGGERED').length, responded: alerts.filter((a) => a.status === 'RESPONDED').length, cleared: alerts.filter((a) => a.status === 'CLEARED').length, readings: readings.length, technicians: technicians.length, tickets: tickets.length });
