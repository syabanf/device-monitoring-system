import * as React from 'react';
import type { DeviceModel } from '@monitoring/types';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Toggle } from '@monitoring/ui';
import { DEFAULT_SENSORS, buildDevice } from '../lib/device-factory';
import { useScoped } from '../state/app-state';


export function AddDeviceDialog({ open, onClose, outletId }: { open: boolean; onClose: () => void; outletId?: string }) {
  const { outlets, devices, deviceTypes, dispatch } = useScoped();
  const [outlet, setOutlet] = React.useState(outletId ?? outlets[0]?.id ?? '');
  const [model, setModel] = React.useState<DeviceModel>('RA12S');
  const [serial, setSerial] = React.useState('');
  const [ip, setIp] = React.useState('');
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>({ TEMPERATURE_HUMIDITY: true, DOOR: true, MOTION: true, POWER: false, PANIC_BUTTON: false });
  const [created, setCreated] = React.useState<string | null>(null);
  React.useEffect(() => { if (outletId) setOutlet(outletId); }, [outletId]);
  React.useEffect(() => { if (open) { setSerial(`${model.replace(/[SEW]$/, '')}-F${Math.floor(60000 + Math.random() * 39999)}-${model}`); setIp(`192.168.${10 + Math.floor(Math.random() * 50)}.${20 + Math.floor(Math.random() * 230)}`); setCreated(null); } }, [open, model]);
  const type = deviceTypes.find((t) => t.model === model) ?? deviceTypes[0]!;
  const capacity = { digital: type.ports.find((p) => p.kind === 'digital')?.count ?? 0, switch: type.ports.find((p) => p.kind === 'switch')?.count ?? 0 };
  const chosen = DEFAULT_SENSORS.filter((s) => enabled[s.type]);
  const usedDigital = chosen.filter((s) => s.portKind === 'digital').length;
  const usedSwitch = chosen.filter((s) => s.portKind === 'switch').length;
  const overCapacity = usedDigital > capacity.digital || usedSwitch > capacity.switch;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (overCapacity || !outlet) return;
    const secondary = devices.filter((d) => d.outletId === outlet).length > 0;
    const { device, sensors } = buildDevice({ outletId: outlet, type, serial, ip, sensorTypes: chosen.map((c) => c.type), secondary });
    dispatch({ type: 'devices/add', device, sensors });
    setCreated(serial);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Add Room Alert device</DialogTitle><DialogDescription>Register a new unit for an outlet and place its default sensors on the floor plan. Session only, no backend yet.</DialogDescription></DialogHeader>
        {created ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-ink p-5 text-white"><p className="text-xs text-sidebar-muted">Device registered</p><p className="mt-1 font-mono text-lg font-bold">{created}</p><p className="mt-1 text-xs text-sidebar-muted">{outlets.find((o) => o.id === outlet)?.name} · {chosen.length} sensors placed on the floor plan</p></div>
            <DialogFooter><Button variant="outline" onClick={() => setCreated(null)}>Add another</Button><Button onClick={onClose}>Done</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Outlet"><Select value={outlet} onValueChange={setOutlet}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></FormField>
              <FormField label="Model"><Select value={model} onValueChange={(v) => setModel(v as DeviceModel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{deviceTypes.map((t) => <SelectItem key={t.id} value={t.model}>{t.name}</SelectItem>)}</SelectContent></Select></FormField>
              <FormField label="Serial" htmlFor="dev-serial"><Input id="dev-serial" value={serial} onChange={(e) => setSerial(e.target.value)} required className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
              <FormField label="IP address" htmlFor="dev-ip"><Input id="dev-ip" value={ip} onChange={(e) => setIp(e.target.value)} required className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Sensors to install <span className="text-xs font-normal text-muted">({usedDigital}/{capacity.digital} digital · {usedSwitch}/{capacity.switch} switch ports)</span></p>
              <div className="grid gap-2 sm:grid-cols-2">
                {DEFAULT_SENSORS.map((s) => (
                  <label key={s.type} className="flex items-center justify-between rounded-2xl bg-surface p-3"><span><span className="block text-sm font-medium">{s.name}</span><span className="block text-xs text-muted">{SENSOR_TYPE_LABEL[s.type]} · {s.portKind} port</span></span><Toggle checked={!!enabled[s.type]} onCheckedChange={(v) => setEnabled({ ...enabled, [s.type]: v })} label={s.name} /></label>
                ))}
              </div>
              {overCapacity ? <p className="mt-2 text-xs text-brand-600">Too many sensors for a {type.name}: it has {capacity.digital} digital and {capacity.switch} switch port(s).</p> : null}
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={overCapacity}>Register device</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
