import * as React from 'react';
import { useSearchParams } from 'react-router';
import { Map as MapIcon, Radio, Wifi, WifiOff } from 'lucide-react';
import type { Sensor } from '@monitoring/types';
import { SENSOR_STATE_LABEL, SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Badge, FloorLegend, FloorPlan, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@monitoring/ui';
import { deviceHealth, fmtAgo, outsideLimits } from '@monitoring/fixtures';
import { latestReadingBySensor } from '../state/readings';
import { useAuth } from '../auth/auth';
import { useMobileScope } from '../state/app-state';
import { SensorIcon } from '../components/SensorIcon';
import { useFloorMarkers } from '../components/useFloorMarkers';
import { SensorPointSheet } from '../components/SensorPointSheet';

function reading(s: Sensor) {
  if (s.type === 'TEMPERATURE_HUMIDITY' || s.type === 'TEMPERATURE') {
    const r = latestReadingBySensor.get(s.id);
    if (!r) return { main: '—', sub: '', alarm: false };
    const alarm = outsideLimits(s, r);
    return { main: `${r.temperatureC.toFixed(1)}°`, sub: `${r.humidityPct.toFixed(0)} %RH · ${fmtAgo(r.at)}`, alarm };
  }
  return { main: SENSOR_STATE_LABEL[s.type]?.normal ?? 'Normal', sub: SENSOR_TYPE_LABEL[s.type], alarm: false };
}

export function DevicesPage() {
  const { user: employee } = useAuth();
  const outletIds = employee?.outletIds ?? [];
  const { outlets, alerts, devicesByOutlet, sensorsByDevice } = useMobileScope(outletIds);
  const [params] = useSearchParams();
  const [tab, setTab] = React.useState(params.get('outlet') ?? outlets[0]?.id ?? '');
  React.useEffect(() => { const o = params.get('outlet'); if (o) setTab(o); }, [params]);
  const [showPlan, setShowPlan] = React.useState(false);
  const [markerId, setMarkerId] = React.useState<string | null>(null);
  const [point, setPoint] = React.useState<Sensor | null>(null);
  const markers = useFloorMarkers(outletIds, tab);
  const openBySensor = React.useMemo(() => { const m = new Map<string, number>(); for (const a of alerts) if (a.status !== 'RESOLVED' && a.status !== 'VERIFIED') m.set(a.sensorId, (m.get(a.sensorId) ?? 0) + 1); return m; }, [alerts]);
  if (!outlets.length) return null;
  return (
    <div className="space-y-5">
      <header className="pt-3"><h1 className="text-[28px] font-bold leading-tight tracking-tight">Devices<span className="text-brand-600">.</span></h1><p className="mt-0.5 text-sm text-muted">Room Alert units at your outlets</p></header>
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setMarkerId(null); }}>
        <TabsList variant="pill" className="w-full overflow-x-auto p-1.5">{outlets.map((o) => <TabsTrigger key={o.id} value={o.id} className="h-10 flex-1">{o.name.replace('Indomaret ', '')}</TabsTrigger>)}</TabsList>
        {outlets.map((o) => (
          <TabsContent key={o.id} value={o.id} className="mt-5 space-y-4">
            <section className="rounded-[26px] bg-white p-4 shadow-card">
              <button type="button" onClick={() => setShowPlan((v) => !v)} className="flex w-full items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40" aria-expanded={showPlan} aria-controls={`floor-plan-${o.id}`}>
                <span className="flex size-10 items-center justify-center rounded-full bg-ink text-white"><MapIcon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">Floor plan</span><span className="block text-xs text-muted">{markers.length} installation points at {o.name.replace('Indomaret ', '')}</span></span>
                <span className="text-xs font-semibold text-brand-600">{showPlan ? 'Hide' : 'Show'}</span>
              </button>
              {showPlan ? (
                <div id={`floor-plan-${o.id}`} className="mt-4">
                  <FloorPlan markers={markers} selectedId={markerId} onSelect={(id) => setMarkerId((m) => (m === id ? null : id))} compact title="Denah" />
                  <FloorLegend className="mt-3" />
                  {markerId ? (() => { const m = markers.find((x) => x.id === markerId); return m ? <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface p-3"><span className={cn('flex size-9 items-center justify-center [&_svg]:size-4', m.kind === 'device' ? 'rounded-xl' : 'rounded-full', m.status === 'alarm' ? 'bg-brand-600 text-white' : 'bg-white')}>{m.icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{m.label}</span><span className="block text-xs text-muted">{m.sublabel} · {m.status === 'alarm' ? `${m.badge} open alert` : m.status}</span></span></div> : null; })() : null}
                </div>
              ) : null}
            </section>
            {(devicesByOutlet.get(o.id) ?? []).map((d) => {
              const sensors = sensorsByDevice.get(d.id) ?? [];
              const online = d.status === 'online';
              return (
                <section key={d.id} className="rounded-[26px] bg-white p-5 shadow-card">
                  <div className="flex items-center gap-3">
                    <span className={cn('flex size-11 items-center justify-center rounded-full', online ? 'bg-ink text-white' : 'bg-surface text-muted')}>{online ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">Room Alert {d.model.replace('RA', '')}</p>
                      <p className="truncate font-mono text-[11px] text-muted">{d.serial}</p>
                    </div>
                    {(() => { const h = deviceHealth(d); return <Badge variant={h.status === 'healthy' ? 'success' : h.status === 'attention' ? 'warning' : 'brand'} dot>{h.status === 'healthy' ? 'Healthy' : h.status === 'attention' ? 'Attention' : 'Critical'}</Badge>; })()}
                  </div>
                  <p className="mt-3 text-xs text-muted">Last push {fmtAgo(d.lastPushAt)} · every {d.pushIntervalSec / 60} min</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {sensors.map((s) => {
                      const r = reading(s);
                      const open = openBySensor.get(s.id) ?? 0;
                      const hot = open > 0 || r.alarm;
                      return (
                        <button key={s.id} type="button" onClick={() => setPoint(s)} aria-label={`Open ${s.name}`} className={cn('rounded-[20px] p-4 text-left active:scale-[0.99]', hot ? 'bg-brand-600 text-white' : 'bg-surface')}>
                          <div className="flex items-center justify-between">
                            <span className={cn('flex size-9 items-center justify-center rounded-full', hot ? 'bg-white/20' : 'bg-white shadow-card')}><SensorIcon type={s.type} className="size-4" /></span>
                            {open ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-brand-600">{open} open</span> : <Radio className={cn('size-3.5', hot ? 'text-white/70' : 'text-silver')} />}
                          </div>
                          <p className="mt-5 text-[26px] font-bold leading-none">{r.main}</p>
                          <p className={cn('mt-2 truncate text-xs font-medium', hot ? 'text-white/90' : 'text-body')}>{s.name}</p>
                          {r.sub ? <p className={cn('truncate text-[10px]', hot ? 'text-white/70' : 'text-muted')}>{r.sub}</p> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
      <SensorPointSheet sensor={point} openAlerts={point ? openBySensor.get(point.id) ?? 0 : 0} onClose={() => setPoint(null)} />
    </div>
  );
}
