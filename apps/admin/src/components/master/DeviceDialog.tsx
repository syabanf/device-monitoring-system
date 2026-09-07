import * as React from 'react';
import type { Device } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monitoring/ui';
import { useScoped } from '../../state/app-state';

/** Edit an existing device. Creating new devices goes through AddDeviceDialog (it also places sensors). */
export function DeviceDialog({ device, onClose }: { device: Device | null; onClose: () => void }) {
  const { outlets, dispatch } = useScoped();
  const [d, setD] = React.useState<Device | null>(device);
  React.useEffect(() => setD(device), [device]);
  if (!d) return <Dialog open={false} />;
  const set = (patch: Partial<Device>) => setD({ ...d, ...patch });
  const toDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
  const fromDate = (v: string) => (v ? `${v}T00:00:00+07:00` : '');
  const submit = (e: React.FormEvent) => { e.preventDefault(); dispatch({ type: 'devices/upsert', device: d }); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Edit device {d.serial}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Outlet"><Select value={d.outletId} onValueChange={(v) => set({ outletId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Status"><Select value={d.status} onValueChange={(v) => set({ status: v as Device['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="offline">Offline</SelectItem></SelectContent></Select></FormField>
            <FormField label="Serial" htmlFor="d-serial"><Input id="d-serial" value={d.serial} onChange={(e) => set({ serial: e.target.value })} required className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
            <FormField label="MAC" htmlFor="d-mac"><Input id="d-mac" value={d.mac} onChange={(e) => set({ mac: e.target.value })} required className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
            <FormField label="IP address" htmlFor="d-ip"><Input id="d-ip" value={d.ip} onChange={(e) => set({ ip: e.target.value })} required className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
            <FormField label="Firmware" htmlFor="d-fw"><Input id="d-fw" value={d.firmware} onChange={(e) => set({ firmware: e.target.value })} className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
            <FormField label="Push interval (sec)" htmlFor="d-push"><Input id="d-push" type="number" min={30} step={30} value={d.pushIntervalSec} onChange={(e) => set({ pushIntervalSec: Number(e.target.value) })} /></FormField>
            <FormField label="Sensor faults" htmlFor="d-faults"><Input id="d-faults" type="number" min={0} value={d.sensorFaults} onChange={(e) => set({ sensorFaults: Number(e.target.value) })} /></FormField>
            <FormField label="Warranty until" htmlFor="d-war"><Input id="d-war" type="date" value={toDate(d.warrantyUntil)} onChange={(e) => set({ warrantyUntil: fromDate(e.target.value) })} /></FormField>
            <FormField label="Next preventive check" htmlFor="d-next"><Input id="d-next" type="date" value={toDate(d.nextMaintenanceAt)} onChange={(e) => set({ nextMaintenanceAt: fromDate(e.target.value) })} /></FormField>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Position on floor plan <span className="text-xs font-normal text-muted">(percent of width / height)</span></p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-muted">X · {d.floor.x}%<input type="range" min={3} max={97} value={d.floor.x} onChange={(e) => set({ floor: { ...d.floor, x: Number(e.target.value) } })} className="mt-1 w-full accent-brand-600" /></label>
              <label className="text-xs text-muted">Y · {d.floor.y}%<input type="range" min={3} max={97} value={d.floor.y} onChange={(e) => set({ floor: { ...d.floor, y: Number(e.target.value) } })} className="mt-1 w-full accent-brand-600" /></label>
            </div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save changes</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
