import * as React from 'react';
import type { DeviceType, SensorType } from '@monitoring/types';
import { SENSOR_TYPE_LABEL, isSensorTypeEnabled } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Textarea, Toggle } from '@monitoring/ui';
import { newId } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';

export const emptyDeviceType = (): DeviceType => ({ id: '', model: 'SP1+', name: '', vendor: 'AKCP', ports: [{ kind: 'digital', count: 1 }], builtInSensors: [], description: '', priceIdr: 0, latestFirmware: 'v1.0.0', maintenanceIntervalDays: 180 });

export function DeviceTypeDialog({ deviceType, onClose }: { deviceType: DeviceType | null; onClose: () => void }) {
  const { dispatch } = useScoped();
  const [d, setD] = React.useState<DeviceType | null>(deviceType);
  React.useEffect(() => setD(deviceType), [deviceType]);
  if (!d) return <Dialog open={false} />;
  const set = (patch: Partial<DeviceType>) => setD({ ...d, ...patch });
  const portCount = (kind: 'digital' | 'switch' | 'analog') => d.ports.find((p) => p.kind === kind)?.count ?? 0;
  const setPort = (kind: 'digital' | 'switch' | 'analog', count: number) => set({ ports: [...d.ports.filter((p) => p.kind !== kind), ...(count > 0 ? [{ kind, count }] : [])].sort((a, b) => ['digital', 'switch', 'analog'].indexOf(a.kind) - ['digital', 'switch', 'analog'].indexOf(b.kind)) });
  const toggleSensor = (t: SensorType, on: boolean) => set({ builtInSensors: on ? [...new Set([...d.builtInSensors, t])] : d.builtInSensors.filter((x) => x !== t) });
  const submit = (e: React.FormEvent) => { e.preventDefault(); dispatch({ type: 'deviceTypes/upsert', deviceType: { ...d, id: d.id || newId('dt'), name: d.name.trim() } }); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{d.id ? 'Edit device type' : 'Add device type'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Model code" htmlFor="dt-model"><Input id="dt-model" value={d.model} onChange={(e) => set({ model: e.target.value.toUpperCase() as DeviceType['model'] })} required className="[&_input]:font-mono" /></FormField>
            <FormField label="Name" htmlFor="dt-name" className="sm:col-span-2"><Input id="dt-name" value={d.name} onChange={(e) => set({ name: e.target.value })} required placeholder="AKCP sensorProbe1+" /></FormField>
          </div>
          <FormField label="Description" htmlFor="dt-desc"><Textarea id="dt-desc" value={d.description} onChange={(e) => set({ description: e.target.value })} className="min-h-20" /></FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(['digital', 'switch', 'analog'] as const).map((k) => <FormField key={k} label={`${k[0]!.toUpperCase()}${k.slice(1)} ports`} htmlFor={`dt-${k}`}><Input id={`dt-${k}`} type="number" min={0} max={16} value={portCount(k)} onChange={(e) => setPort(k, Number(e.target.value))} /></FormField>)}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Built-in sensors</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{(Object.keys(SENSOR_TYPE_LABEL) as SensorType[]).map((t) => { const available = isSensorTypeEnabled(t); return <label key={t} className={`flex items-center justify-between rounded-2xl bg-surface px-3 py-2${available ? '' : ' opacity-50'}`}><span className="text-sm">{SENSOR_TYPE_LABEL[t]}</span><Toggle checked={d.builtInSensors.includes(t)} disabled={!available} onCheckedChange={(v) => toggleSensor(t, v)} label={SENSOR_TYPE_LABEL[t]} /></label>; })}</div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField label="Vendor" htmlFor="dt-vendor"><Input id="dt-vendor" value={d.vendor} onChange={(e) => set({ vendor: e.target.value })} /></FormField>
            <FormField label="Price (IDR)" htmlFor="dt-price"><Input id="dt-price" type="number" min={0} step={1000} value={d.priceIdr} onChange={(e) => set({ priceIdr: Number(e.target.value) })} /></FormField>
            <FormField label="Latest firmware" htmlFor="dt-fw"><Input id="dt-fw" value={d.latestFirmware} onChange={(e) => set({ latestFirmware: e.target.value })} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
            <FormField label="Service interval (days)" htmlFor="dt-int"><Input id="dt-int" type="number" min={30} value={d.maintenanceIntervalDays} onChange={(e) => set({ maintenanceIntervalDays: Number(e.target.value) })} /></FormField>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{d.id ? 'Save changes' : 'Create type'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
