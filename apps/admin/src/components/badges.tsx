import type { AlertCategory, AlertStatus, DeviceStatus, HealthStatus, RegistrationStatus, SensorType, TicketPriority, TicketStatus } from '@monitoring/types';
import { ALERT_CATEGORY_LABEL, ALERT_STATUS_LABEL, HEALTH_LABEL, TICKET_STATUS_LABEL } from '@monitoring/types';
import { Badge } from '@monitoring/ui';
import { Activity, DoorOpen, Flame, Siren, Thermometer, Zap } from 'lucide-react';

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const variant = status === 'TRIGGERED' ? 'brand' : status === 'RESPONDED' ? 'info' : 'default';
  return <Badge variant={variant} dot>{ALERT_STATUS_LABEL[status]}</Badge>;
}
export function CategoryBadge({ category }: { category: AlertCategory }) {
  return <Badge variant={category === 'COMFORT' ? 'info' : 'outline'}>{ALERT_CATEGORY_LABEL[category]}</Badge>;
}
export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return <Badge variant={status === 'online' ? 'success' : 'muted'} dot>{status === 'online' ? 'Online' : 'Offline'}</Badge>;
}
export function RegistrationBadge({ status }: { status: RegistrationStatus }) {
  return <Badge variant={status === 'approved' ? 'success' : 'warning'} dot>{status === 'approved' ? 'Approved' : 'Pending'}</Badge>;
}
export function SensorIcon({ type, className }: { type: SensorType; className?: string }) {
  const cls = className ?? 'size-4';
  switch (type) {
    case 'TEMPERATURE':
    case 'TEMPERATURE_HUMIDITY': return <Thermometer className={cls} />;
    case 'DOOR': return <DoorOpen className={cls} />;
    case 'MOTION': return <Activity className={cls} />;
    case 'POWER': return <Zap className={cls} />;
    case 'PANIC_BUTTON': return <Siren className={cls} />;
    default: return <Flame className={cls} />;
  }
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return <Badge variant={status === 'healthy' ? 'success' : status === 'attention' ? 'warning' : 'brand'} dot>{HEALTH_LABEL[status]}</Badge>;
}
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const v = status === 'OPEN' ? 'brand' : status === 'SCHEDULED' ? 'info' : status === 'IN_PROGRESS' ? 'warning' : 'success';
  return <Badge variant={v} dot>{TICKET_STATUS_LABEL[status]}</Badge>;
}
export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const v = priority === 'CRITICAL' ? 'brand' : priority === 'HIGH' ? 'warning' : priority === 'MEDIUM' ? 'info' : 'muted';
  return <Badge variant={v} className="capitalize">{priority.toLowerCase()}</Badge>;
}
