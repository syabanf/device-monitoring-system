import * as React from 'react';
import type { Device, PortKind, Sensor, SensorType } from '@monitoring/types';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@monitoring/ui';
import { newId } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';

export function emptySensor(device: Device): Sensor {
  const free = device.ports.find((p) => !p.sensorId) ?? device.ports[0]!;
  return { id: '', deviceId: device.id, outletId: device.outletId, name: '', type: free.kind === 'digital' ? 'TEMPERATURE_HUMIDITY' : 'DOOR', portKind: free.kind, portIndex: free.index, unit: free.kind === 'digital' ? '°C' : 'state', thresholds: free.kind === 'digital' ? { min: 18, max: 28, humidityMin: 30, humidityMax: 60 } : undefined, enabled: true, floor: { x: 50, y: 50 } };
}

export function SensorDialog({ sensor, device, onClose }: { sensor: Sensor | null; device: Device; onClose: () => void }) {
  const { dispatch } = useScoped();
  const [s, setS] = React.useState<Sensor | null>(sensor);
  React.useEffect(() => setS(sensor), [sensor]);
  if (!s) return <Dialog open={false} />;
  const set = (patch: Partial<Sensor>) => setS({ ...s, ...patch });
  const isTemp = s.type === 'TEMPERATURE' || s.type === 'TEMPERATURE_HUMIDITY';
  const ports = device.ports.filter((p) => !p.sensorId || p.sensorId === s.id);
  const limits = s.thresholds;
  const inverted = isTemp && (
    (limits?.min != null && limits.max != null && limits.min >= limits.max) ||
    (limits?.humidityMin != null && limits.humidityMax != null && limits.humidityMin >= limits.humidityMax)
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inverted) return;
    dispatch({ type: 'sensors/upsert', sensor: { ...s, id: s.id || newId('sen'), name: s.name.trim(), unit: isTemp ? '°C' : 'state', thresholds: isTemp ? s.thresholds ?? { min: 18, max: 28, humidityMin: 30, humidityMax: 60 } : undefined } });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{s.id ? 'Edit sensor' : 'Add sensor'} · {device.serial}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Sensor name" htmlFor="s-name"><Input id="s-name" value={s.name} onChange={(e) => set({ name: e.target.value })} required placeholder="e.g. Cooler Area Temp & RH" /></FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Type"><Select value={s.type} onValueChange={(v) => set({ type: v as SensorType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(SENSOR_TYPE_LABEL) as SensorType[]).map((t) => <SelectItem key={t} value={t}>{SENSOR_TYPE_LABEL[t]}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Port" hint={ports.length ? undefined : 'No free port on this device'}>
              <Select value={`${s.portKind}:${s.portIndex}`} onValueChange={(v) => { const [k, i] = v.split(':'); set({ portKind: k as PortKind, portIndex: Number(i) }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ports.map((p) => <SelectItem key={`${p.kind}:${p.index}`} value={`${p.kind}:${p.index}`}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          {isTemp ? (
            <div>
              <p className="mb-2 text-sm font-medium">Limits for this point</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <FormField label="Lower °C" htmlFor="s-min"><Input id="s-min" type="number" step="0.1" value={s.thresholds?.min ?? 18} onChange={(e) => set({ thresholds: { ...s.thresholds, min: Number(e.target.value) } })} /></FormField>
                <FormField label="Upper °C" htmlFor="s-max"><Input id="s-max" type="number" step="0.1" value={s.thresholds?.max ?? 28} onChange={(e) => set({ thresholds: { ...s.thresholds, max: Number(e.target.value) } })} /></FormField>
                <FormField label="Lower %RH" htmlFor="s-hmin"><Input id="s-hmin" type="number" value={s.thresholds?.humidityMin ?? 30} onChange={(e) => set({ thresholds: { ...s.thresholds, humidityMin: Number(e.target.value) } })} /></FormField>
                <FormField label="Upper %RH" htmlFor="s-hmax"><Input id="s-hmax" type="number" value={s.thresholds?.humidityMax ?? 60} onChange={(e) => set({ thresholds: { ...s.thresholds, humidityMax: Number(e.target.value) } })} /></FormField>
              </div>
              <p className={cn('mt-2 text-xs', inverted ? 'text-brand-600' : 'text-muted')} role={inverted ? 'alert' : undefined}>
                {inverted ? 'Each lower limit has to sit below its upper one.' : 'A reading outside this band opens an alert, and a reading back inside closes it.'}
              </p>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium">Position on floor plan</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-xs text-muted">X · {s.floor.x}%<input type="range" min={3} max={97} value={s.floor.x} onChange={(e) => set({ floor: { ...s.floor, x: Number(e.target.value) } })} className="mt-1 w-full accent-brand-600" /></label>
              <label className="text-xs text-muted">Y · {s.floor.y}%<input type="range" min={3} max={97} value={s.floor.y} onChange={(e) => set({ floor: { ...s.floor, y: Number(e.target.value) } })} className="mt-1 w-full accent-brand-600" /></label>
            </div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!ports.length || inverted}>{s.id ? 'Save changes' : 'Add sensor'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
