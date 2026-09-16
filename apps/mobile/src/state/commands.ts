import type { AppAction, AppState } from '@monitoring/fixtures';
import type { Endpoints } from '@monitoring/api-client';

/**
 * Sends one reducer action to the API and answers with what to apply locally. The phone only
 * writes alerts and tickets; master data belongs to the admin dashboard.
 */
export async function perform(api: Endpoints, state: AppState, action: AppAction): Promise<AppAction[]> {
  switch (action.type) {
    case 'alerts/acknowledge':
      return [{ type: 'alerts/replace', alert: await api.alerts.setStatus(action.alertId, 'ACKNOWLEDGED') }];
    case 'alerts/startResponse':
      return [{ type: 'alerts/replace', alert: await api.alerts.setStatus(action.alertId, 'RESPONDING') }];
    case 'alerts/respond':
      return [{ type: 'alerts/replace', alert: await api.alerts.respond(action.alertId, action.notes, action.photoUrls) }];
    case 'alerts/clear':
      return [{ type: 'alerts/replace', alert: await api.alerts.setStatus(action.alertId, 'RESOLVED') }];

    case 'tickets/create': {
      const t = action.ticket;
      const ticket = await api.tickets.create({
        outletId: t.outletId, deviceId: t.deviceId, sensorId: t.sensorId, type: t.type, priority: t.priority,
        title: t.title, description: t.description, technicianId: t.technicianId, scheduledAt: t.scheduledAt,
      });
      return [{ type: 'tickets/replace', ticket }];
    }
    case 'tickets/setStatus': {
      const current = state.tickets.find((t) => t.id === action.ticketId);
      const ticket = await api.tickets.patch(action.ticketId, {
        status: action.status,
        notes: action.notes?.trim() ? action.notes.trim() : undefined,
        photoUrls: action.photoUrls?.length ? [...(current?.photoUrls ?? []), ...action.photoUrls] : undefined,
      });
      return [{ type: 'tickets/replace', ticket }];
    }
    case 'tickets/assign': {
      const ticket = await api.tickets.patch(action.ticketId, { technicianId: action.technicianId ?? '' });
      return [{ type: 'tickets/replace', ticket }];
    }

    default:
      return [action];
  }
}
