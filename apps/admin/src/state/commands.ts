import type { AppAction, AppState } from '@monitoring/fixtures';
import type { Endpoints } from '@monitoring/api-client';
import type { ContactPerson, Device, DeviceType, Employee, Outlet, Sensor, Technician } from '@monitoring/types';

/**
 * Turns one reducer action into the API call behind it and answers with the actions to apply
 * locally, carrying the rows the server wrote. Pages keep dispatching the same actions they
 * always did; only the trip to the server happens here.
 */
export async function perform(api: Endpoints, state: AppState, action: AppAction): Promise<AppAction[]> {
  switch (action.type) {
    case 'outlets/upsert': {
      const known = state.outlets.some((o) => o.id === action.outlet.id);
      const outlet = known
        ? await api.outlets.update(action.outlet.id, outletInput(action.outlet))
        : await api.outlets.create(outletInput(action.outlet));
      return [{ type: 'outlets/upsert', outlet }];
    }
    case 'outlets/remove':
      await api.outlets.remove(action.outletId);
      return [action];

    case 'deviceTypes/upsert': {
      const known = state.deviceTypes.some((t) => t.id === action.deviceType.id);
      const deviceType = known
        ? await api.deviceTypes.update(action.deviceType.id, deviceTypeInput(action.deviceType))
        : await api.deviceTypes.create(deviceTypeInput(action.deviceType));
      return [{ type: 'deviceTypes/upsert', deviceType }];
    }
    case 'deviceTypes/remove':
      await api.deviceTypes.remove(action.deviceTypeId);
      return [action];

    case 'devices/add': {
      const created = await api.devices.create({
        outletId: action.device.outletId,
        deviceTypeId: action.device.deviceTypeId,
        serial: action.device.serial,
        mac: action.device.mac,
        ip: action.device.ip,
        sensorTypes: action.sensors.map((s) => s.type),
      });
      return [{ type: 'devices/add', device: created.device, sensors: created.sensors }];
    }
    case 'devices/upsert': {
      const saved = await api.devices.update(action.device.id, deviceInput(action.device));
      return [{ type: 'devices/upsert', device: saved.device }, ...saved.sensors.map((sensor): AppAction => ({ type: 'sensors/upsert', sensor }))];
    }
    case 'devices/remove':
      await api.devices.remove(action.deviceId);
      return [action];

    case 'sensors/upsert': {
      const sensor = await api.devices.saveSensor(action.sensor.deviceId, action.sensor.id, sensorInput(action.sensor));
      return [{ type: 'sensors/upsert', sensor }];
    }
    case 'sensors/remove': {
      const sensor = state.sensors.find((s) => s.id === action.sensorId);
      if (!sensor) return [action];
      await api.devices.removeSensor(sensor.deviceId, sensor.id);
      return [action];
    }

    case 'employees/upsert': {
      const known = state.employees.some((e) => e.id === action.employee.id);
      const employee = known
        ? await api.employees.update(action.employee.id, employeeInput(action.employee))
        : await api.employees.create(employeeInput(action.employee));
      return [{ type: 'employees/upsert', employee }];
    }
    case 'employees/remove':
      await api.employees.remove(action.employeeId);
      return [action];
    case 'employees/approve':
      return [{ type: 'employees/upsert', employee: await api.employees.approve(action.employeeId) }];
    case 'employees/generateToken':
      return [{ type: 'employees/upsert', employee: await api.employees.issueToken(action.employeeId) }];
    case 'employees/revoke':
      return [{ type: 'employees/upsert', employee: await api.employees.revoke(action.employeeId) }];

    case 'technicians/upsert': {
      const known = state.technicians.some((t) => t.id === action.technician.id);
      const technician = known
        ? await api.technicians.update(action.technician.id, technicianInput(action.technician))
        : await api.technicians.create(technicianInput(action.technician));
      return [{ type: 'technicians/upsert', technician }];
    }
    case 'technicians/remove':
      await api.technicians.remove(action.technicianId);
      return [action];

    case 'contacts/upsert': {
      const known = state.contacts.some((c) => c.id === action.contact.id);
      const contact = known
        ? await api.contacts.update(action.contact.id, contactInput(action.contact))
        : await api.contacts.create(contactInput(action.contact));
      return [{ type: 'contacts/upsert', contact }];
    }
    case 'contacts/remove':
      await api.contacts.remove(action.contactId);
      return [action];

    case 'alerts/acknowledge':
      return [{ type: 'alerts/replace', alert: await api.alerts.setStatus(action.alertId, 'ACKNOWLEDGED') }];
    case 'alerts/startResponse':
      return [{ type: 'alerts/replace', alert: await api.alerts.setStatus(action.alertId, 'RESPONDING') }];
    case 'alerts/respond':
      return [{ type: 'alerts/replace', alert: await api.alerts.respond(action.alertId, action.notes, action.photoUrls) }];
    case 'alerts/clear':
      return [{ type: 'alerts/replace', alert: await api.alerts.setStatus(action.alertId, 'RESOLVED') }];
    case 'alerts/verify':
      return [{ type: 'alerts/replace', alert: await api.alerts.setStatus(action.alertId, 'VERIFIED') }];

    case 'tickets/create': {
      const t = action.ticket;
      const ticket = await api.tickets.create({
        outletId: t.outletId,
        deviceId: t.deviceId,
        sensorId: t.sensorId,
        type: t.type,
        priority: t.priority,
        title: t.title,
        description: t.description,
        technicianId: t.technicianId,
        scheduledAt: t.scheduledAt,
      });
      return [{ type: 'tickets/replace', ticket }];
    }
    case 'tickets/setStatus': {
      const current = state.tickets.find((t) => t.id === action.ticketId);
      const ticket = await api.tickets.patch(action.ticketId, {
        status: action.status,
        notes: action.notes?.trim() ? action.notes.trim() : undefined,
        // The API stores the list it is given, so keep the photos the ticket already carries.
        photoUrls: action.photoUrls?.length ? [...(current?.photoUrls ?? []), ...action.photoUrls] : undefined,
      });
      return [{ type: 'tickets/replace', ticket }];
    }
    case 'tickets/assign': {
      // An empty string hands the ticket back to the pool; leaving the field out changes nothing.
      const ticket = await api.tickets.patch(action.ticketId, { technicianId: action.technicianId ?? '' });
      return [{ type: 'tickets/replace', ticket }];
    }

    case 'distributors/upsert': {
      const d = action.distributor;
      const distributor = await api.distributor.update({ code: d.code, name: d.name, region: d.region, city: d.city, address: d.address });
      return [{ type: 'distributors/upsert', distributor: { ...d, ...distributor } }];
    }

    // Ingested alerts arrive from the API itself, so they need no call back to it.
    case 'alerts/ingest':
    case 'alerts/replace':
    case 'tickets/replace':
    case 'state/hydrate':
      return [action];
  }
}

const outletInput = (o: Outlet) => ({
  code: o.code, name: o.name, address: o.address, city: o.city, province: o.province, lat: o.lat, lng: o.lng,
  mapsUrl: o.mapsUrl, openTime: o.openTime, closeTime: o.closeTime, timezone: o.timezone, phone: o.phone,
});

const deviceTypeInput = (t: DeviceType) => ({
  model: t.model, name: t.name, vendor: t.vendor, ports: t.ports, builtInSensors: t.builtInSensors,
  description: t.description, priceIdr: t.priceIdr, latestFirmware: t.latestFirmware,
  maintenanceIntervalDays: t.maintenanceIntervalDays,
});

const deviceInput = (d: Device) => ({
  outletId: d.outletId, serial: d.serial, mac: d.mac, ip: d.ip, firmware: d.firmware, status: d.status, pushIntervalSec: d.pushIntervalSec,
  warrantyUntil: d.warrantyUntil, lastMaintenanceAt: d.lastMaintenanceAt, nextMaintenanceAt: d.nextMaintenanceAt,
  sensorFaults: d.sensorFaults, floor: d.floor, channels: d.channels,
});

const sensorInput = (s: Sensor) => ({
  name: s.name, type: s.type, portKind: s.portKind, portIndex: s.portIndex, unit: s.unit,
  thresholds: s.thresholds, enabled: s.enabled, floor: s.floor,
});

const employeeInput = (e: Employee) => ({
  name: e.name, phone: e.phone, email: e.email, role: e.role, outletIds: e.outletIds,
  primaryOutletId: e.primaryOutletId, avatarColor: e.avatarColor,
});

const technicianInput = (t: Technician) => ({
  name: t.name, phone: t.phone, specialty: t.specialty, avatarColor: t.avatarColor, email: t.email,
});

const contactInput = (c: ContactPerson) => ({
  outletId: c.outletId, name: c.name, phone: c.phone, email: c.email, role: c.role,
  isPrimary: c.isPrimary, channels: c.channels,
});
