import * as React from 'react';
import { Link, useParams } from 'react-router';
import { Clock, ExternalLink, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { EMPLOYEE_ROLE_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, FloorLegend, FloorPlan, Tabs, TabsContent, TabsList, TabsTrigger } from '@monitoring/ui';
import { fmtAgo, isSolved } from '@monitoring/fixtures';
import { outletById } from '../../state/lookups';
import { useFloorMarkers } from '../../components/useFloorMarkers';
import { OutletDialog } from '../../components/master/OutletDialog';
import { ConfirmDelete } from '../../components/master/ConfirmDelete';
import { useScoped } from '../../state/app-state';
import { DeviceStatusBadge, RegistrationBadge } from '../../components/badges';
import { SensorRow } from '../../components/SensorReading';
import { AlertListItem } from '../../components/AlertListItem';
import { NotFoundPage } from '../NotFoundPage';

export function OutletDetailPage() {
  const { outletId = '' } = useParams();
  const outlet = outletById.get(outletId);
  const { alerts, employees, contacts, outletIds, devicesByOutlet, sensorsByDevice, dispatch } = useScoped();
  const navigate = useNavigate();
  const [editing, setEditing] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const markers = useFloorMarkers(outletId);
  const [markerId, setMarkerId] = React.useState<string | null>(null);
  const outletAlerts = React.useMemo(() => alerts.filter((a) => a.outletId === outletId), [alerts, outletId]);
  if (!outlet || !outletIds.has(outlet.id)) return <NotFoundPage />;

  const devices = devicesByOutlet.get(outlet.id) ?? [];
  const staff = employees.filter((e) => e.outletIds.includes(outlet.id));
  const outletContacts = contacts.filter((c) => c.outletId === outlet.id);
  const open = outletAlerts.filter((a) => !isSolved(a));
  const openBySensor = new Map<string, number>();
  for (const a of open) openBySensor.set(a.sensorId, (openBySensor.get(a.sensorId) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <p className="font-mono text-xs text-muted">{outlet.code}</p>
            <h1 className="text-2xl font-bold">{outlet.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" />{outlet.address}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
              <span className="flex items-center gap-1.5"><Clock className="size-4" />{outlet.openTime}–{outlet.closeTime} ({outlet.timezone})</span>
              <span className="flex items-center gap-1.5"><Phone className="size-4" />{outlet.phone}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil />Edit</Button>
              <Button variant="outline" size="sm" className="text-brand-600" onClick={() => setRemoving(true)}><Trash2 />Delete</Button>
              <Button asChild variant="outline" size="sm"><a href={outlet.mapsUrl} target="_blank" rel="noreferrer"><ExternalLink />Google Maps</a></Button>
            </div>
            {open.length ? <Badge variant="danger" dot>{open.length} open alert{open.length > 1 ? 's' : ''}</Badge> : <Badge variant="success" dot>All clear</Badge>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="floor">
        <TabsList>
          <TabsTrigger value="floor">Floor plan</TabsTrigger>
          <TabsTrigger value="devices">Devices ({devices.length})</TabsTrigger>
          <TabsTrigger value="employees">Employees ({staff.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({outletContacts.length})</TabsTrigger>
          <TabsTrigger value="alerts">Recent alerts ({outletAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="floor">
          <Card>
            <CardContent className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div><FloorPlan markers={markers} selectedId={markerId} onSelect={setMarkerId} title="Denah outlet" /><FloorLegend className="mt-3" /></div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Installation points</p>
                {markers.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMarkerId(m.id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors ${markerId === m.id ? 'bg-ink text-white' : 'bg-surface-2 hover:bg-white hover:shadow-card'}`}>
                    <span className={`flex size-8 shrink-0 items-center justify-center [&_svg]:size-4 ${m.kind === 'device' ? 'rounded-xl' : 'rounded-full'} ${m.status === 'alarm' ? 'bg-brand-600 text-white' : m.status === 'offline' ? 'bg-silver text-white' : markerId === m.id ? 'bg-white/15 text-white' : 'bg-white text-ink'}`}>{m.icon}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.label}</span><span className={`block truncate text-xs ${markerId === m.id ? 'text-white/70' : 'text-muted'}`}>{m.sublabel} · x {m.x}% y {m.y}%</span></span>
                    {m.badge ? <Badge variant="brand">{m.badge} open</Badge> : null}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {devices.map((d) => (
            <Card key={d.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle><Link to={`/devices/${d.id}`} className="hover:text-brand-700">{d.serial}</Link></CardTitle>
                  <p className="text-xs text-muted">Room Alert {d.model.replace('RA', '')} · {d.mac} · {d.ip}</p>
                  <p className="text-xs text-muted">Last push {fmtAgo(d.lastPushAt)}</p>
                </div>
                <DeviceStatusBadge status={d.status} />
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {(sensorsByDevice.get(d.id) ?? []).map((s) => <SensorRow key={s.id} sensor={s} openAlerts={openBySensor.get(s.id) ?? 0} />)}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="employees">
          <Card className="divide-y divide-border">
            {staff.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={e.name} color={e.avatarColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="truncate text-xs text-muted">{EMPLOYEE_ROLE_LABEL[e.role]} · {e.phone}</p>
                </div>
                <RegistrationBadge status={e.registrationStatus} />
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card className="divide-y divide-border">
            {outletContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={c.name} color="#0e7490" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name} {c.isPrimary ? <Badge variant="brand" className="ml-1">Primary</Badge> : null}</p>
                  <p className="truncate text-xs text-muted">{c.role} · {c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                </div>
                <div className="flex gap-1">{c.channels.map((ch) => <Badge key={ch} variant="outline">{ch}</Badge>)}</div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-2">
          {outletAlerts.length === 0 ? <EmptyState title="No alerts recorded" /> : outletAlerts.slice(0, 20).map((a) => <AlertListItem key={a.id} alert={a} />)}
        </TabsContent>
      </Tabs>
      <OutletDialog outlet={editing ? outlet : null} onClose={() => setEditing(false)} />
      <ConfirmDelete open={removing} title={`Delete ${outlet.name}?`} description="Its devices, sensors, contacts, tickets and alert history will be removed." onCancel={() => setRemoving(false)} onConfirm={() => { dispatch({ type: 'outlets/remove', outletId: outlet.id }); navigate('/outlets'); }} />
    </div>
  );
}
