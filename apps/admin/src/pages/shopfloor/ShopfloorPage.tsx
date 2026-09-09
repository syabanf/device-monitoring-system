import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, MapPin, Plus, Router, Search, Wrench } from 'lucide-react';
import type { Outlet } from '@monitoring/types';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, FloorLegend, FloorPlan, Input, KeyValue, PageHeader, cn } from '@monitoring/ui';
import { deviceHealth, fmtAgo, fmtDateTime, isSolved, latestReadingBySensor } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';
import { useFloorMarkers } from '../../components/useFloorMarkers';
import { AlertStatusBadge, DeviceStatusBadge, HealthBadge, SensorIcon } from '../../components/badges';
import { NewTicketDialog } from '../devices/NewTicketDialog';
import { AddDeviceDialog } from '../../components/AddDeviceDialog';

type Filter = 'all' | 'alerts' | 'offline';

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  React.useEffect(() => { if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 }); }, [map, bounds]);
  return null;
}
function FlyTo({ outlet }: { outlet: Outlet | null }) {
  const map = useMap();
  React.useEffect(() => { if (outlet) map.flyTo([outlet.lat, outlet.lng], Math.max(map.getZoom(), 14), { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.6 }); }, [map, outlet]);
  return null;
}

export function ShopfloorPage() {
  const { outlets, devicesByOutlet, sensorsByDevice, alerts, deviceById, sensorById } = useScoped();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const filter = (params.get('filter') === 'alerts' || params.get('filter') === 'offline' ? params.get('filter') : 'all') as Filter;
  const update = (patch: Record<string, string | null>) => { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(patch)) value == null ? next.delete(key) : next.set(key, value); setParams(next, { replace: true }); };
  const [markerId, setMarkerId] = React.useState<string | null>(null);
  const [ticketFor, setTicketFor] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  const stats = React.useMemo(() => {
    const m = new Map<string, { open: number; offline: number; devices: number }>();
    for (const o of outlets) {
      const devs = devicesByOutlet.get(o.id) ?? [];
      m.set(o.id, { open: 0, offline: devs.filter((d) => d.status === 'offline').length, devices: devs.length });
    }
    for (const a of alerts) if (!isSolved(a)) { const s = m.get(a.outletId); if (s) s.open++; }
    return m;
  }, [outlets, devicesByOutlet, alerts]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return outlets.filter((o) => {
      const st = stats.get(o.id)!;
      if (filter === 'alerts' && !st.open) return false;
      if (filter === 'offline' && !st.offline) return false;
      return !s || o.name.toLowerCase().includes(s) || o.code.toLowerCase().includes(s) || o.address.toLowerCase().includes(s);
    });
  }, [outlets, stats, q, filter]);

  const selectedId = params.get('outlet') ?? filtered[0]?.id ?? null;
  const selected = outlets.find((o) => o.id === selectedId) ?? null;
  const select = (id: string) => { update({ outlet: id }); setMarkerId(null); };
  const markers = useFloorMarkers(selected?.id);
  const bounds = React.useMemo<LatLngBoundsExpression | null>(() => (outlets.length ? outlets.map((o) => [o.lat, o.lng] as [number, number]) : null), [outlets]);
  const center: [number, number] = outlets.length ? [outlets[0]!.lat, outlets[0]!.lng] : [-7.2756, 112.7422];

  const markerDevice = markerId ? deviceById.get(markerId) : undefined;
  const markerSensor = markerId ? sensorById.get(markerId) : undefined;
  const sensorAlerts = markerSensor ? alerts.filter((a) => a.sensorId === markerSensor.id).slice(0, 3) : [];
  const reading = markerSensor && markerSensor.type === 'TEMPERATURE_HUMIDITY' ? latestReadingBySensor.get(markerSensor.id) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="Shopfloor" description="Where every Room Alert unit and sensor is installed: outlet map and in-store floor plan" actions={<Button onClick={() => setAdding(true)}><Plus />Add device</Button>} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="h-[420px] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:font-sans" role="region" aria-label="Outlet installation map. Use the keyboard-accessible outlet list below to select a location.">
              <MapContainer center={center} zoom={12} scrollWheelZoom className="z-0">
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitBounds bounds={bounds} />
                <FlyTo outlet={selected} />
                {outlets.map((o) => {
                  const st = stats.get(o.id)!;
                  const color = st.open ? '#ED1C24' : st.offline ? '#8b8b8b' : '#101112';
                  const isSel = o.id === selectedId;
                  return (
                    <CircleMarker key={o.id} center={[o.lat, o.lng]} radius={isSel ? 11 : 8} pathOptions={{ color: isSel ? '#ED1C24' : '#ffffff', weight: isSel ? 3 : 2, fillColor: color, fillOpacity: 0.95 }} eventHandlers={{ click: () => select(o.id) }}>
                      <Popup><div className="font-sans text-xs"><p className="font-bold">{o.name}</p><p>{st.devices} device · {st.open} open alert · {st.offline} offline</p></div></Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" />Normal</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand-600" />Open alerts</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-silver" />Device offline</li>
              </ul>
              <span className="ml-auto text-xs text-muted">{outlets.length} installation points</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 pb-3">
              <div className="flex items-center justify-between"><CardTitle>Outlets</CardTitle><Badge variant="default">{filtered.length}</Badge></div>
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Search outlet" leftIcon={<Search />} value={q} onChange={(e) => update({ q: e.target.value || null })} className="min-w-52 flex-1 [&_input]:h-10" />
                {([['all', 'All'], ['alerts', 'With alerts'], ['offline', 'Offline']] as [Filter, string][]).map(([f, l]) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => update({ filter: f === 'all' ? null : f })} className={cn('h-10 rounded-full px-4 text-xs font-semibold transition-colors', filter === f ? 'bg-ink text-white' : 'bg-surface text-body hover:bg-surface-2')}>{l}</button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="max-h-72 space-y-1.5 overflow-y-auto">
              {filtered.length === 0 ? <EmptyState title="No outlets match" className="py-6" /> : filtered.map((o) => { const st = stats.get(o.id)!; return (
                <button key={o.id} type="button" aria-pressed={o.id === selectedId} onClick={() => select(o.id)} className={cn('flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors', o.id === selectedId ? 'bg-ink text-white' : 'bg-surface-2 hover:bg-white hover:shadow-card')}>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', st.open ? 'bg-brand-600 text-white' : st.offline ? 'bg-silver text-white' : o.id === selectedId ? 'bg-white/15 text-white' : 'bg-white text-ink')}><MapPin className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{o.name}</span><span className={cn('block truncate text-xs', o.id === selectedId ? 'text-white/70' : 'text-muted')}>{o.code} · {st.devices} device{st.devices > 1 ? 's' : ''}</span></span>
                  {st.open ? <Badge variant={o.id === selectedId ? 'outline' : 'brand'} className={o.id === selectedId ? 'border-white/30 text-white' : ''}>{st.open} open</Badge> : null}
                  {st.offline ? <Badge variant="muted">{st.offline} offline</Badge> : null}
                </button>
              ); })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <p className="font-mono text-xs text-muted">{selected.code}</p>
                    <CardTitle className="text-xl">{selected.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted">{selected.address}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm"><a href={selected.mapsUrl} target="_blank" rel="noreferrer"><ExternalLink />Maps</a></Button>
                    <Button asChild size="sm" variant="secondary"><Link to={`/outlets/${selected.id}`}>Outlet</Link></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <FloorPlan markers={markers} selectedId={markerId} onSelect={setMarkerId} title="Denah outlet" />
                  <FloorLegend className="mt-3" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle>{markerDevice ? 'Room Alert unit' : markerSensor ? 'Installation point' : 'Installed equipment'}</CardTitle></CardHeader>
                <CardContent>
                  {markerDevice ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold">{markerDevice.serial}</span><DeviceStatusBadge status={markerDevice.status} /><HealthBadge status={deviceHealth(markerDevice).status} /></div>
                      <dl className="mt-2 divide-y divide-border">
                        <KeyValue label="Model">Room Alert {markerDevice.model.replace('RA', '')}</KeyValue>
                        <KeyValue label="Network"><span className="font-mono text-xs">{markerDevice.ip} · {markerDevice.mac}</span></KeyValue>
                        <KeyValue label="Last push">{fmtDateTime(markerDevice.lastPushAt)} ({fmtAgo(markerDevice.lastPushAt)})</KeyValue>
                        <KeyValue label="Sensors">{(sensorsByDevice.get(markerDevice.id) ?? []).length} connected</KeyValue>
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm"><Link to={`/devices/${markerDevice.id}`}><Router />Device detail</Link></Button>
                        <Button size="sm" variant="outline" onClick={() => setTicketFor(markerDevice.id)}><Wrench />Maintenance ticket</Button>
                      </div>
                    </div>
                  ) : markerSensor ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-surface"><SensorIcon type={markerSensor.type} /></span><span className="text-sm font-semibold">{markerSensor.name}</span><Badge variant="outline">{SENSOR_TYPE_LABEL[markerSensor.type]}</Badge></div>
                      <dl className="mt-2 divide-y divide-border">
                        <KeyValue label="Port">{markerSensor.portKind} port {markerSensor.portIndex} on {deviceById.get(markerSensor.deviceId)?.serial}</KeyValue>
                        {reading ? <KeyValue label="Latest reading">{reading.temperatureC.toFixed(1)} °C · {reading.humidityPct.toFixed(0)} %RH <span className="text-xs text-muted">({fmtAgo(reading.at)})</span></KeyValue> : null}
                        {markerSensor.thresholds ? <KeyValue label="Thresholds">{markerSensor.thresholds.min}–{markerSensor.thresholds.max} °C · {markerSensor.thresholds.humidityMin}–{markerSensor.thresholds.humidityMax} %RH</KeyValue> : null}
                        <KeyValue label="Position">x {markerSensor.floor.x}% · y {markerSensor.floor.y}% of floor plan</KeyValue>
                      </dl>
                      {sensorAlerts.length ? <div className="mt-3 space-y-1.5">{sensorAlerts.map((a) => <Link key={a.id} to={`/alerts?tab=${a.status.toLowerCase()}&id=${a.id}`} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs hover:bg-white hover:shadow-card"><span className="truncate">{a.message} · {fmtAgo(a.triggerTime)}</span><AlertStatusBadge status={a.status} /></Link>)}</div> : <p className="mt-3 text-xs text-muted">No alerts recorded on this sensor.</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline"><Link to={`/devices/${markerSensor.deviceId}`}><Router />Parent device</Link></Button>
                        <Button size="sm" variant="outline" onClick={() => setTicketFor(markerSensor.deviceId)}><Wrench />Report sensor issue</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(devicesByOutlet.get(selected.id) ?? []).map((d) => (
                        <button key={d.id} type="button" onClick={() => setMarkerId(d.id)} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left hover:bg-white hover:shadow-card">
                          <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-white"><Router className="size-4" /></span>
                          <span className="min-w-0 flex-1"><span className="block font-mono text-xs font-semibold">{d.serial}</span><span className="block text-xs text-muted">{(sensorsByDevice.get(d.id) ?? []).map((s) => s.name).join(' · ')}</span></span>
                          <DeviceStatusBadge status={d.status} />
                        </button>
                      ))}
                      <p className="text-xs text-muted">Click a marker on the floor plan to inspect an installation point.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : <Card><EmptyState icon={<MapPin />} title="Select an outlet" description="Pick an outlet from the map or the list to see its floor plan." className="py-20" /></Card>}
        </div>
      </div>
      <NewTicketDialog open={!!ticketFor} onClose={() => setTicketFor(null)} deviceId={ticketFor ?? undefined} />
      <AddDeviceDialog open={adding} onClose={() => setAdding(false)} outletId={selected?.id} />
    </div>
  );
}
