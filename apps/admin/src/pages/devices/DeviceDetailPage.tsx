import * as React from 'react';
import { Link, useParams } from 'react-router';
import { Pencil, Plus, Send, Trash2, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, FloorLegend, FloorPlan, KeyValue, cn } from '@monitoring/ui';
import { useFloorMarkers as useFloorMarkersSafe } from '../../components/useFloorMarkers';
import { Map as MapIcon } from 'lucide-react';
import { deviceHealth, fmtAgo, fmtDate, fmtDateTime, isSolved, isTicketOpen } from '@monitoring/fixtures';
import { outletById, technicianById, deviceTypeById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { DeviceStatusBadge, HealthBadge, PriorityBadge, SensorIcon, TicketStatusBadge } from '../../components/badges';
import { TicketSheet } from './TicketSheet';
import { NewTicketDialog } from './NewTicketDialog';
import { DeviceDialog } from '../../components/master/DeviceDialog';
import { SensorDialog, emptySensor } from '../../components/master/SensorDialog';
import { ConfirmDelete } from '../../components/master/ConfirmDelete';
import type { Sensor } from '@monitoring/types';
import { SensorRow } from '../../components/SensorReading';
import { AlertListItem } from '../../components/AlertListItem';
import { NotFoundPage } from '../NotFoundPage';

export function DeviceDetailPage() {
  const { deviceId = '' } = useParams();
  const { alerts, outletIds, tickets, deviceById, sensorById, sensorsByDevice, dispatch } = useScoped();
  const device = deviceById.get(deviceId);
  const [ticketId, setTicketId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [sensorEdit, setSensorEdit] = React.useState<Sensor | null>(null);
  const [sensorRemove, setSensorRemove] = React.useState<Sensor | null>(null);
  const navigate = useNavigate();
  const deviceAlerts = React.useMemo(() => alerts.filter((a) => a.deviceId === deviceId), [alerts, deviceId]);
  if (!device || !outletIds.has(device.outletId)) return <NotFoundPage />;
  const outlet = outletById.get(device.outletId)!;
  const type = deviceTypeById.get(device.deviceTypeId)!;
  const sensors = sensorsByDevice.get(device.id) ?? [];
  const openBySensor = new Map<string, number>();
  for (const a of deviceAlerts) if (!isSolved(a)) openBySensor.set(a.sensorId, (openBySensor.get(a.sensorId) ?? 0) + 1);
  const health = deviceHealth(device);
  const deviceTickets = tickets.filter((t) => t.deviceId === device.id);
  const allMarkers = useFloorMarkersSafe(device.outletId);
  const mySensorIds = new Set(sensors.map((x) => x.id));
  const floorMarkers = allMarkers.map((m) => (m.id === device.id || mySensorIds.has(m.id) ? m : { ...m, status: 'muted' as const }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil />Edit device</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-brand-600"><Trash2 />Remove device</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Remove {device.serial}?</AlertDialogTitle>
            <AlertDialogDescription>The unit, its sensors and its maintenance tickets will be removed from {outlet.name} for this session.</AlertDialogDescription>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { dispatch({ type: 'devices/remove', deviceId: device.id }); navigate('/devices'); }}>Remove</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="font-mono text-lg">{device.serial}</CardTitle>
              <p className="text-sm text-muted">{type.name} · <Link to={`/outlets/${outlet.id}`} className="text-brand-700 hover:underline">{outlet.name}</Link></p>
            </div>
            <DeviceStatusBadge status={device.status} />
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <KeyValue label="MAC address"><span className="font-mono">{device.mac}</span></KeyValue>
              <KeyValue label="IP address"><span className="font-mono">{device.ip}</span></KeyValue>
              <KeyValue label="Firmware">{device.firmware}</KeyValue>
              <KeyValue label="Push interval">every {device.pushIntervalSec / 60} min</KeyValue>
              <KeyValue label="Last push">{fmtDateTime(device.lastPushAt)} <span className="text-muted">({fmtAgo(device.lastPushAt)})</span></KeyValue>
              <KeyValue label="Installed">{fmtDateTime(device.installedAt)}</KeyValue>
              <KeyValue label="Channels">
                <div className="flex gap-1.5">
                  <Badge variant="success" dot>App</Badge>
                  <Badge variant="muted"><Send className="size-3" />Telegram · next phase</Badge>
                </div>
              </KeyValue>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Port map</CardTitle><p className="text-sm text-muted">Each switch sensor on its own port so admins can tell which sensor is abnormal.</p></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {device.ports.map((p) => {
                const s = p.sensorId ? sensorById.get(p.sensorId) : undefined;
                return (
                  <div key={`${p.kind}-${p.index}`} className={cn('rounded-lg border p-3', s ? 'border-brand-200 bg-brand-50/50' : 'border-dashed border-border bg-gray-50')}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{p.label}</p>
                    {s ? (
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <SensorIcon type={s.type} className="size-4 text-brand-700" />
                        <span className="truncate font-medium">{s.name}</span>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted">Empty</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div><CardTitle className="flex items-center gap-2"><MapIcon className="size-4 text-muted" />Shopfloor position</CardTitle><p className="text-sm text-muted">This unit and its sensors on the {outlet.name} floor plan; other equipment is greyed out.</p></div>
          <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to={`/shopfloor?outlet=${device.outletId}`}>Open shopfloor</Link></Button><Button size="sm" variant="outline" onClick={() => setEditing(true)}>Move unit</Button></div>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div><FloorPlan markers={floorMarkers} selectedId={sensorEdit?.id ?? null} onSelect={(id) => { const s = sensors.find((x) => x.id === id); if (s) setSensorEdit(s); }} title="Denah outlet" /><FloorLegend className="mt-3" /></div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Installation points · click to edit position</p>
            <div className="flex items-center gap-3 rounded-2xl bg-ink p-3 text-white"><span className="flex size-9 items-center justify-center rounded-xl bg-white/15"><Send className="size-4" /></span><span className="min-w-0 flex-1"><span className="block font-mono text-xs font-semibold">{device.serial}</span><span className="block text-xs text-white/70">Unit · x {device.floor.x}% · y {device.floor.y}%</span></span></div>
            {sensors.map((s) => <button key={s.id} type="button" onClick={() => setSensorEdit(s)} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left hover:bg-white hover:shadow-card"><span className="flex size-9 items-center justify-center rounded-full bg-white"><SensorIcon type={s.type} className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{s.name}</span><span className="block text-xs text-muted">{s.portKind} port {s.portIndex} · x {s.floor.x}% · y {s.floor.y}%</span></span></button>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div><CardTitle className="flex items-center gap-2"><Wrench className="size-4 text-muted" />Maintenance</CardTitle><p className="text-sm text-muted">Hardware health, service history and warranty</p></div>
          <div className="flex items-center gap-2"><HealthBadge status={health.status} /><Button size="sm" onClick={() => setCreating(true)}><Plus />Ticket</Button></div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <dl className="divide-y divide-border">
              <KeyValue label="Uptime 30d"><span className={cn('font-semibold', device.uptimePct < 95 && 'text-brand-600')}>{device.uptimePct.toFixed(1)}%</span></KeyValue>
              <KeyValue label="Firmware">{device.firmware}{device.firmware !== type.latestFirmware ? <Badge variant="warning" className="ml-2">update to {type.latestFirmware}</Badge> : <Badge variant="success" className="ml-2">latest</Badge>}</KeyValue>
              <KeyValue label="Last check">{device.lastMaintenanceAt ? fmtDate(device.lastMaintenanceAt) : <span className="text-muted">never</span>}</KeyValue>
              <KeyValue label="Next check"><span className={cn(health.issues.some((i) => i.code === 'maintenance_overdue') && 'font-semibold text-brand-600')}>{fmtDate(device.nextMaintenanceAt)}</span> <span className="text-xs text-muted">every {type.maintenanceIntervalDays} days</span></KeyValue>
              <KeyValue label="Warranty">until {fmtDate(device.warrantyUntil)}</KeyValue>
            </dl>
            {health.issues.length ? <ul className="mt-3 space-y-1.5">{health.issues.map((i) => <li key={i.code} className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-xs', i.severity === 'critical' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-800')}><span className={cn('size-1.5 rounded-full', i.severity === 'critical' ? 'bg-brand-600' : 'bg-amber-500')} />{i.label}</li>)}</ul> : null}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Service tickets ({deviceTickets.length})</p>
            {deviceTickets.length === 0 ? <EmptyState title="No tickets for this device" className="py-6" /> : (
              <div className="space-y-2">
                {deviceTickets.slice(0, 6).map((t) => { const tech = t.technicianId ? technicianById.get(t.technicianId) : undefined; return (
                  <button key={t.id} type="button" onClick={() => setTicketId(t.id)} className={cn('flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white hover:shadow-card', isTicketOpen(t) ? 'bg-surface-2' : 'bg-surface-2/50')}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.title}</span><span className="block text-xs text-muted">{t.id} · {fmtDate(t.createdAt)}{tech ? ` · ${tech.name}` : ''}</span></span>
                    <PriorityBadge priority={t.priority} /><TicketStatusBadge status={t.status} />
                  </button>
                ); })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Sensors ({sensors.length})</CardTitle><Button size="sm" variant="outline" disabled={!device.ports.some((p) => !p.sensorId)} onClick={() => setSensorEdit(emptySensor(device))}><Plus />Add sensor</Button></CardHeader>
        <CardContent className="divide-y divide-border">
          {sensors.length === 0 ? <EmptyState title="No sensors connected" className="py-6" /> : null}
          {sensors.map((s) => (
            <div key={s.id} className="group relative">
              <div className="absolute right-0 top-3 hidden gap-1 group-hover:flex"><Button variant="ghost" size="icon" className="size-8" aria-label="Edit sensor" onClick={() => setSensorEdit(s)}><Pencil /></Button><Button variant="ghost" size="icon" className="size-8 text-brand-600" aria-label="Remove sensor" onClick={() => setSensorRemove(s)}><Trash2 /></Button></div>
              <SensorRow sensor={s} openAlerts={openBySensor.get(s.id) ?? 0} className="pr-20 group-hover:pr-20" />
              {s.thresholds ? (
                <p className="-mt-1 pb-2 pl-12 text-xs text-muted">
                  Thresholds: {s.thresholds.min}–{s.thresholds.max} °C · {s.thresholds.humidityMin}–{s.thresholds.humidityMax} %RH · {SENSOR_TYPE_LABEL[s.type]}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent alerts ({deviceAlerts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {deviceAlerts.length === 0 ? <EmptyState title="No alerts from this device" /> : deviceAlerts.slice(0, 10).map((a) => <AlertListItem key={a.id} alert={a} />)}
        </CardContent>
      </Card>
      <TicketSheet ticket={tickets.find((t) => t.id === ticketId) ?? null} onClose={() => setTicketId(null)} />
      <NewTicketDialog open={creating} onClose={() => setCreating(false)} deviceId={device.id} />
      <DeviceDialog device={editing ? device : null} onClose={() => setEditing(false)} />
      <SensorDialog sensor={sensorEdit} device={device} onClose={() => setSensorEdit(null)} />
      <ConfirmDelete open={!!sensorRemove} title={`Remove ${sensorRemove?.name}?`} description="The port will be freed on the device." onCancel={() => setSensorRemove(null)} onConfirm={() => { if (sensorRemove) dispatch({ type: 'sensors/remove', sensorId: sensorRemove.id }); setSensorRemove(null); }} />
    </div>
  );
}
