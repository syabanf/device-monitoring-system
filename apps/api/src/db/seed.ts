import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from '../lib/password';

/**
 * Loads the same generated fixtures the frontend ships, so the mock adapter and the real API
 * show identical demo data. Run it against a fresh database: pnpm --filter @monitoring/api db:seed
 */
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '../../../../packages/fixtures/data');
const read = <T>(file: string): T => JSON.parse(readFileSync(join(dataDir, `${file}.json`), 'utf8')) as T;

const DEMO_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
const MAX_READINGS = Number(process.env.SEED_MAX_READINGS ?? 5000);

const db = new PrismaClient();

async function main() {
  const distributors = read<any[]>('distributors');
  const outlets = read<any[]>('outlets');
  const deviceTypes = read<any[]>('device-types');
  const devices = read<any[]>('devices');
  const sensors = read<any[]>('sensors');
  const employees = read<any[]>('employees');
  const technicians = read<any[]>('technicians');
  const contacts = read<any[]>('contact-persons');
  const admins = read<any[]>('admin-users');
  const alerts = read<any[]>('alerts');
  const tickets = read<any[]>('maintenance-tickets');
  const readings = read<any[]>('readings');

  const outletTenant = new Map(outlets.map((o) => [o.id, o.distributorId as string]));
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  console.log('clearing existing rows');
  await db.$transaction([
    db.alertResponse.deleteMany(), db.alert.deleteMany(), db.reading.deleteMany(), db.maintenanceTicket.deleteMany(),
    db.contactPerson.deleteMany(), db.sensor.deleteMany(), db.device.deleteMany(), db.deviceType.deleteMany(),
    db.employee.deleteMany(), db.technician.deleteMany(), db.adminUser.deleteMany(), db.outlet.deleteMany(),
    db.distributor.deleteMany(), db.outboxEvent.deleteMany(), db.requestLog.deleteMany(), db.unmatchedEvent.deleteMany(),
  ]);

  await db.distributor.createMany({ data: distributors });
  await db.outlet.createMany({ data: outlets });
  await db.adminUser.createMany({ data: admins.map((a) => ({ id: a.id, distributorId: a.distributorId, name: a.name, email: a.email, role: a.role, avatarColor: a.avatarColor, passwordHash })) });
  await db.deviceType.createMany({ data: deviceTypes.map((t) => ({ ...t, ports: t.ports as Prisma.InputJsonValue })) });

  await db.device.createMany({
    data: devices.map((d) => ({
      id: d.id, distributorId: outletTenant.get(d.outletId)!, outletId: d.outletId, deviceTypeId: d.deviceTypeId, model: d.model,
      serial: d.serial, mac: d.mac, ip: d.ip, firmware: d.firmware, status: d.status,
      lastPushAt: new Date(d.lastPushAt), installedAt: new Date(d.installedAt), pushIntervalSec: d.pushIntervalSec,
      ports: d.ports as Prisma.InputJsonValue, channels: d.channels,
      warrantyUntil: new Date(d.warrantyUntil), lastMaintenanceAt: d.lastMaintenanceAt ? new Date(d.lastMaintenanceAt) : null,
      nextMaintenanceAt: new Date(d.nextMaintenanceAt), uptimePct: d.uptimePct, sensorFaults: d.sensorFaults,
      floorX: d.floor.x, floorY: d.floor.y,
    })),
  });

  await db.sensor.createMany({
    data: sensors.map((s) => ({
      id: s.id, distributorId: outletTenant.get(s.outletId)!, deviceId: s.deviceId, outletId: s.outletId, name: s.name,
      type: s.type, portKind: s.portKind, portIndex: s.portIndex, unit: s.unit,
      thresholds: s.thresholds ?? undefined, enabled: s.enabled, floorX: s.floor.x, floorY: s.floor.y,
    })),
  });

  await db.technician.createMany({ data: technicians });
  for (const e of employees) {
    await db.employee.create({
      data: {
        id: e.id, distributorId: e.distributorId, primaryOutletId: e.primaryOutletId, name: e.name, phone: e.phone, email: e.email,
        role: e.role, registrationToken: e.registrationToken, registrationStatus: e.registrationStatus,
        registeredAt: e.registeredAt ? new Date(e.registeredAt) : null, approvedAt: e.approvedAt ? new Date(e.approvedAt) : null,
        avatarColor: e.avatarColor, outlets: { connect: e.outletIds.map((id: string) => ({ id })) },
      },
    });
  }
  await db.contactPerson.createMany({ data: contacts });

  await db.alert.createMany({
    data: alerts.map((a) => ({
      id: a.id, distributorId: a.distributorId, outletId: a.outletId, deviceId: a.deviceId, sensorId: a.sensorId,
      sensorName: a.sensorName, sensorType: a.sensorType, category: a.category, status: a.status,
      triggerValue: a.triggerValue, triggerTime: new Date(a.triggerTime),
      clearValue: a.clearValue, clearTime: a.clearTime ? new Date(a.clearTime) : null, message: a.message, channels: a.channels,
      assigneeEmployeeId: a.assigneeEmployeeId ?? null,
      acknowledgedAt: a.acknowledgedAt ? new Date(a.acknowledgedAt) : null,
      respondingAt: a.respondingAt ? new Date(a.respondingAt) : null,
      resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : null,
      verifiedAt: a.verifiedAt ? new Date(a.verifiedAt) : null,
    })),
  });
  await db.alertResponse.createMany({
    data: alerts.filter((a) => a.response).map((a) => ({
      alertId: a.id, employeeId: a.response.employeeId, notes: a.response.notes, photoUrls: a.response.photoUrls,
      respondedAt: new Date(a.response.respondedAt), responseDurationSec: a.response.responseDurationSec,
    })),
  });
  // Alert ids come from the Room Alert cloud, so move the sequence past them.
  const maxAlertId = alerts.reduce((m, a) => Math.max(m, a.id), 0);
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Alert"', 'id'), ${maxAlertId + 1}, false)`);

  await db.maintenanceTicket.createMany({
    data: tickets.map((t) => ({
      id: t.id, distributorId: t.distributorId, outletId: t.outletId, deviceId: t.deviceId, sensorId: t.sensorId,
      type: t.type, priority: t.priority, status: t.status, title: t.title, description: t.description, technicianId: t.technicianId,
      createdAt: new Date(t.createdAt), scheduledAt: t.scheduledAt ? new Date(t.scheduledAt) : null,
      completedAt: t.completedAt ? new Date(t.completedAt) : null, partsUsed: t.partsUsed, notes: t.notes, photoUrls: t.photoUrls,
    })),
  });

  const recent = readings.slice(-MAX_READINGS);
  await db.reading.createMany({
    data: recent.map((r: any) => (Array.isArray(r)
      ? { sensorId: r[0], at: new Date(r[1]), temperatureC: r[2], humidityPct: r[3] }
      : { sensorId: r.sensorId, at: new Date(r.at), temperatureC: r.temperatureC, humidityPct: r.humidityPct })),
    skipDuplicates: true,
  });

  console.log(`seeded ${outlets.length} outlets, ${devices.length} devices, ${sensors.length} sensors, ${alerts.length} alerts, ${tickets.length} tickets, ${recent.length} readings`);
  console.log(`admin password for every seeded admin: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
