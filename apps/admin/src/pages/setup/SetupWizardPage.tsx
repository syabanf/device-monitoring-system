import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Building2, Check, Cpu, MapPin, Plug, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import type { Employee, EmployeeRole, SensorType } from '@monitoring/types';
import { EMPLOYEE_ROLE_LABEL, SENSOR_TYPE_LABEL, isSensorTypeEnabled } from '@monitoring/types';
import { Badge, Button, Card, CardContent, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Toggle, BrandMark, cn, BRAND } from '@monitoring/ui';
import { nowIso, generateToken, newId } from '@monitoring/fixtures';
import { useAuth } from '../../auth/auth';
import { useAppState, useScoped } from '../../state/app-state';
import { useApi } from '../../state/api';
import { DEFAULT_SENSORS, buildDevice } from '../../lib/device-factory';

export const SETUP_KEY = 'ms.admin.setupDone';
export const isSetupDone = () => { try { return localStorage.getItem(SETUP_KEY) === '1'; } catch { return false; } };

const STEPS = [
  { key: 'org', title: 'Distribution center', icon: Building2 },
  { key: 'outlets', title: 'Outlets', icon: MapPin },
  { key: 'devices', title: 'Room Alert units', icon: Cpu },
  { key: 'people', title: 'Employees', icon: Users },
  { key: 'integration', title: 'Integration', icon: Plug },
  { key: 'done', title: 'Finish', icon: Sparkles },
] as const;

interface OutletDraft { key: string; code: string; name: string; address: string; city: string; model: string; sensors: SensorType[] }
interface EmployeeDraft { key: string; name: string; phone: string; email: string; role: EmployeeRole; outletKey: string }

export function SetupWizardPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { distributorId, deviceTypes, dispatch } = useScoped();
  const { state } = useAppState();
  const { config, saveConfig } = useApi();
  const distributor = state.distributors.find((d) => d.id === distributorId);
  const [step, setStep] = React.useState(0);
  const [org, setOrg] = React.useState({ name: distributor?.name ?? '', code: distributor?.code ?? '', city: distributor?.city ?? '', region: distributor?.region ?? '', address: distributor?.address ?? '' });
  const [outlets, setOutlets] = React.useState<OutletDraft[]>([{ key: newId('o'), code: 'IDM-SBY-0021', name: 'Indomaret ', address: '', city: 'Surabaya', model: deviceTypes[0]?.model ?? 'RA3S', sensors: ['TEMPERATURE_HUMIDITY'] }]);
  const [people, setPeople] = React.useState<EmployeeDraft[]>([]);
  const [integ, setInteg] = React.useState({ apiBaseUrl: '', telegram: false, imap: false });
  React.useEffect(() => {
    if (config) setInteg({ apiBaseUrl: config.apiBaseUrl, telegram: config.telegram.enabled, imap: config.imap.enabled });
  }, [config]);
  const [created, setCreated] = React.useState<{ outlets: number; devices: number; employees: number } | null>(null);
  const [saving, setSaving] = React.useState(false);
  if (!session) return null;

  const validOutlets = outlets.filter((o) => o.name.trim().length > 10 && o.code.trim());
  const canNext = step === 0 ? org.name.trim().length > 2 : step === 1 ? validOutlets.length > 0 : true;

  // Each step waits for the API, because an outlet has to exist before its unit can point at it.
  const strip = (c: NonNullable<typeof config>) => ({ apiBaseUrl: c.apiBaseUrl, webhookPath: c.webhookPath, roomAlert: c.roomAlert, imap: c.imap, telegram: c.telegram, push: c.push });

  const finish = async () => {
    setSaving(true);
    if (distributor) await dispatch({ type: 'distributors/upsert', distributor: { ...distributor, ...org } });
    const keyToId = new Map<string, string>();
    let devices = 0;
    for (const o of validOutlets) {
      const draft = { id: newId('out'), distributorId, code: o.code.trim().toUpperCase(), name: o.name.trim(), address: o.address.trim() || `${o.city}`, city: o.city, province: distributor?.region ?? 'Jawa Timur', lat: -7.2756 + (Math.random() - 0.5) * 0.1, lng: 112.7422 + (Math.random() - 0.5) * 0.1, mapsUrl: '', openTime: '07:00', closeTime: '22:00', timezone: 'Asia/Jakarta', phone: '' };
      const [saved] = await dispatch({ type: 'outlets/upsert', outlet: draft });
      if (saved?.type !== 'outlets/upsert') continue;
      keyToId.set(o.key, saved.outlet.id);
      const type = deviceTypes.find((t) => t.model === o.model);
      if (type) {
        const built = buildDevice({ outletId: saved.outlet.id, type, sensorTypes: o.sensors });
        const [addition] = await dispatch({ type: 'devices/add', device: built.device, sensors: built.sensors });
        if (addition?.type === 'devices/add') devices++;
      }
    }
    for (const p of people) {
      const oid = keyToId.get(p.outletKey);
      if (!oid || !p.name.trim()) continue;
      const emp: Employee = { id: newId('emp'), distributorId, outletIds: [oid], primaryOutletId: oid, name: p.name.trim(), phone: p.phone, email: p.email.trim().toLowerCase(), role: p.role, registrationToken: generateToken(), registrationStatus: 'pending', registeredAt: nowIso(), approvedAt: null, avatarColor: BRAND.ink };
      await dispatch({ type: 'employees/upsert', employee: emp });
    }
    if (config) await saveConfig({ ...strip(config), apiBaseUrl: integ.apiBaseUrl, telegram: { ...config.telegram, enabled: integ.telegram }, imap: { ...config.imap, enabled: integ.imap } });
    try { localStorage.setItem(SETUP_KEY, '1'); } catch { /* ignore */ }
    setCreated({ outlets: keyToId.size, devices, employees: people.filter((p) => p.name.trim() && keyToId.has(p.outletKey)).length });
    setSaving(false);
    setStep(STEPS.length - 1);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><BrandMark className="text-2xl" /><div><h1 className="text-xl font-bold">Initial setup</h1><p className="text-xs text-muted">Get a distribution center monitoring in a few minutes. Everything can be edited later from master data.</p></div></div>
        <Button asChild variant="ghost" size="sm"><Link to="/">Skip for now</Link></Button>
      </div>
      <ol className="grid grid-cols-6 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.key} className={cn('flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-semibold', i === step ? 'bg-ink text-white' : i < step ? 'bg-white text-foreground shadow-card' : 'bg-surface-2 text-muted')}>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-white text-muted')}>{i < step ? <Check className="size-3.5" /> : <s.icon className="size-3.5" />}</span>
            <span className="truncate">{s.title}</span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="p-6">
          {step === 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Which distribution center is this dashboard for?</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Name" htmlFor="w-name"><Input id="w-name" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} required /></FormField>
                <FormField label="Code" htmlFor="w-code"><Input id="w-code" value={org.code} onChange={(e) => setOrg({ ...org, code: e.target.value.toUpperCase() })} className="[&_input]:font-mono" /></FormField>
                <FormField label="City" htmlFor="w-city"><Input id="w-city" value={org.city} onChange={(e) => setOrg({ ...org, city: e.target.value })} /></FormField>
                <FormField label="Province / region" htmlFor="w-region"><Input id="w-region" value={org.region} onChange={(e) => setOrg({ ...org, region: e.target.value })} /></FormField>
                <FormField label="Address" htmlFor="w-addr" className="sm:col-span-2"><Input id="w-addr" value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} /></FormField>
              </div>
              <p className="text-xs text-muted">Signed in as {session.userId} · this center can monitor up to 700 outlets.</p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Add the outlets to monitor</h2><Button size="sm" variant="outline" onClick={() => setOutlets([...outlets, { key: newId('o'), code: `IDM-SBY-${String(21 + outlets.length).padStart(4, '0')}`, name: 'Indomaret ', address: '', city: 'Surabaya', model: deviceTypes[0]?.model ?? 'RA3S', sensors: ['TEMPERATURE_HUMIDITY'] }])}><Plus />Add row</Button></div>
              <div className="space-y-2">
                {outlets.map((o, i) => (
                  <div key={o.key} className="grid grid-cols-1 gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-[8rem_1fr_1fr_8rem_auto]">
                    <Input value={o.code} onChange={(e) => setOutlets(outlets.map((x) => (x.key === o.key ? { ...x, code: e.target.value.toUpperCase() } : x)))} className="[&_input]:h-10 [&_input]:font-mono [&_input]:text-xs" aria-label="Code" />
                    <Input value={o.name} onChange={(e) => setOutlets(outlets.map((x) => (x.key === o.key ? { ...x, name: e.target.value } : x)))} placeholder="Indomaret …" className="[&_input]:h-10" aria-label="Outlet name" />
                    <Input value={o.address} onChange={(e) => setOutlets(outlets.map((x) => (x.key === o.key ? { ...x, address: e.target.value } : x)))} placeholder="Address" className="[&_input]:h-10" aria-label="Address" />
                    <Input value={o.city} onChange={(e) => setOutlets(outlets.map((x) => (x.key === o.key ? { ...x, city: e.target.value } : x)))} className="[&_input]:h-10" aria-label="City" />
                    <Button variant="ghost" size="icon" className="size-10 text-brand-600" aria-label="Remove row" disabled={outlets.length === 1 && i === 0} onClick={() => setOutlets(outlets.filter((x) => x.key !== o.key))}><Trash2 /></Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">{validOutlets.length} outlet{validOutlets.length === 1 ? '' : 's'} ready. Coordinates default to the city center; refine them later in Outlet master data or the Shopfloor view.</p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Choose the Room Alert unit and sensors per outlet</h2>
              <div className="space-y-2">
                {validOutlets.map((o) => { const type = deviceTypes.find((t) => t.model === o.model); const cap = { digital: type?.ports.find((p) => p.kind === 'digital')?.count ?? 0, switch: type?.ports.find((p) => p.kind === 'switch')?.count ?? 0 }; const used = { digital: o.sensors.filter((s) => DEFAULT_SENSORS.find((d) => d.type === s)?.portKind === 'digital').length, switch: o.sensors.filter((s) => DEFAULT_SENSORS.find((d) => d.type === s)?.portKind === 'switch').length }; return (
                  <div key={o.key} className="rounded-2xl bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="flex-1 font-semibold">{o.name} <span className="font-mono text-xs text-muted">{o.code}</span></p>
                      <Select value={o.model} onValueChange={(v) => setOutlets(outlets.map((x) => (x.key === o.key ? { ...x, model: v } : x)))}><SelectTrigger className="w-48 bg-white"><SelectValue /></SelectTrigger><SelectContent>{deviceTypes.map((t) => <SelectItem key={t.id} value={t.model}>{t.name}</SelectItem>)}</SelectContent></Select>
                      <Badge variant={used.digital > cap.digital || used.switch > cap.switch ? 'brand' : 'outline'}>{used.digital}/{cap.digital} digital · {used.switch}/{cap.switch} switch</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DEFAULT_SENSORS.map((s) => { const available = isSensorTypeEnabled(s.type); const on = available && o.sensors.includes(s.type); return <button key={s.type} type="button" disabled={!available} title={available ? undefined : 'Not part of this rollout yet'} onClick={() => setOutlets(outlets.map((x) => (x.key === o.key ? { ...x, sensors: on ? x.sensors.filter((t) => t !== s.type) : [...x.sensors, s.type] } : x)))} className={cn('h-9 rounded-full px-3.5 text-xs font-semibold', on ? 'bg-ink text-white' : 'bg-white text-body shadow-card', !available && 'opacity-40')}>{SENSOR_TYPE_LABEL[s.type]}</button>; })}
                    </div>
                  </div>
                ); })}
              </div>
              <p className="text-xs text-muted">Sensors beyond the unit's port capacity are skipped. This rollout installs temperature and humidity only; door, motion, power and panic sensors come later.</p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Register outlet employees (optional)</h2><Button size="sm" variant="outline" onClick={() => setPeople([...people, { key: newId('p'), name: '', phone: '', email: '', role: 'store_manager', outletKey: validOutlets[0]?.key ?? '' }])}><Plus />Add employee</Button></div>
              {people.length === 0 ? <p className="rounded-2xl bg-surface p-4 text-sm text-muted">Each employee gets a registration token to sign in to the mobile app. You can also import them later from User Management.</p> : null}
              <div className="space-y-2">
                {people.map((p) => (
                  <div key={p.key} className="grid grid-cols-1 gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-[1fr_1fr_1fr_10rem_11rem_auto]">
                    <Input value={p.name} onChange={(e) => setPeople(people.map((x) => (x.key === p.key ? { ...x, name: e.target.value } : x)))} placeholder="Full name" className="[&_input]:h-10" aria-label="Name" />
                    <Input value={p.email} onChange={(e) => setPeople(people.map((x) => (x.key === p.key ? { ...x, email: e.target.value } : x)))} placeholder="Email" className="[&_input]:h-10" aria-label="Email" />
                    <Input value={p.phone} onChange={(e) => setPeople(people.map((x) => (x.key === p.key ? { ...x, phone: e.target.value } : x)))} placeholder="Phone" className="[&_input]:h-10" aria-label="Phone" />
                    <Select value={p.role} onValueChange={(v) => setPeople(people.map((x) => (x.key === p.key ? { ...x, role: v as EmployeeRole } : x)))}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(EMPLOYEE_ROLE_LABEL) as EmployeeRole[]).map((r) => <SelectItem key={r} value={r}>{EMPLOYEE_ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select>
                    <Select value={p.outletKey} onValueChange={(v) => setPeople(people.map((x) => (x.key === p.key ? { ...x, outletKey: v } : x)))}><SelectTrigger className="bg-white"><SelectValue placeholder="Outlet" /></SelectTrigger><SelectContent>{validOutlets.map((o) => <SelectItem key={o.key} value={o.key}>{o.name}</SelectItem>)}</SelectContent></Select>
                    <Button variant="ghost" size="icon" className="size-10 text-brand-600" aria-label="Remove" onClick={() => setPeople(people.filter((x) => x.key !== p.key))}><Trash2 /></Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Connect the blackbox</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Backend API base URL" htmlFor="w-api"><Input id="w-api" value={integ.apiBaseUrl} onChange={(e) => setInteg({ ...integ, apiBaseUrl: e.target.value })} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
                <FormField label="Webhook URL (paste into the Room Alert account HTTP POST action)" htmlFor="w-secret" className="sm:col-span-2" hint="The signing secret lives in the API environment as WEBHOOK_SECRET."><Input id="w-secret" readOnly value={`${integ.apiBaseUrl.replace(/\/$/, '')}${config?.webhookPath ?? '/webhooks/roomalert'}`} className="[&_input]:bg-surface [&_input]:font-mono [&_input]:text-xs" /></FormField>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl bg-surface p-4"><span><span className="block text-sm font-medium">Telegram ANBot broadcast</span><span className="block text-xs text-muted">Broadcast every alert to registered chats</span></span><Toggle checked={integ.telegram} onCheckedChange={(v) => setInteg({ ...integ, telegram: v })} label="Telegram" /></label>
                <label className="flex items-center justify-between rounded-2xl bg-surface p-4"><span><span className="block text-sm font-medium">E-mail parser (IMAP)</span><span className="block text-xs text-muted">For Room Alert accounts without HTTP POST</span></span><Toggle checked={integ.imap} onCheckedChange={(v) => setInteg({ ...integ, imap: v })} label="IMAP" /></label>
              </div>
              <p className="text-xs text-muted">Until a backend exists the adapter stays in mock mode; these values are stored so the switch is a single toggle on the Integration page.</p>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="size-8" /></span>
              <h2 className="mt-4 text-2xl font-bold">Setup complete<span className="text-brand-600">.</span></h2>
              <p className="mt-1 max-w-md text-sm text-muted">{created ? `${created.outlets} outlet(s), ${created.devices} Room Alert unit(s) and ${created.employees} employee(s) were created for ${org.name}.` : 'Nothing was created.'} Alerts will appear on the dashboard as soon as the units push status.</p>
              <div className="mt-6 flex gap-2"><Button onClick={() => navigate('/')}>Open dashboard</Button><Button variant="outline" onClick={() => navigate('/shopfloor')}>Place sensors on floor plans</Button><Button variant="outline" onClick={() => navigate('/integration')}>Integration</Button></div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {step < 5 ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft />Back</Button>
          {step < 4 ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue<ArrowRight /></Button> : <Button onClick={() => void finish()} loading={saving}><Sparkles />Finish setup</Button>}
        </div>
      ) : null}
    </div>
  );
}
