import * as React from 'react';
import type { Outlet } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monitoring/ui';
import { newId } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';

export function emptyOutlet(distributorId: string, seq: number): Outlet {
  return { id: '', distributorId, code: `IDM-NEW-${String(seq).padStart(4, '0')}`, name: 'Indomaret ', address: '', city: 'Surabaya', province: 'Jawa Timur', lat: -7.2756, lng: 112.7422, mapsUrl: '', openTime: '07:00', closeTime: '22:00', timezone: 'Asia/Jakarta', phone: '' };
}

export function OutletDialog({ outlet, onClose }: { outlet: Outlet | null; onClose: (saved?: Outlet) => void }) {
  const { dispatch } = useScoped();
  const [d, setD] = React.useState<Outlet | null>(outlet);
  React.useEffect(() => setD(outlet), [outlet]);
  if (!d) return <Dialog open={false} />;
  const set = (patch: Partial<Outlet>) => setD({ ...d, ...patch });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved: Outlet = { ...d, id: d.id || newId('out'), name: d.name.trim(), mapsUrl: d.mapsUrl.trim() || `https://maps.google.com/?q=${d.lat},${d.lng}` };
    dispatch({ type: 'outlets/upsert', outlet: saved });
    onClose(saved);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{d.id ? 'Edit outlet' : 'Add outlet'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <FormField label="Code" htmlFor="o-code"><Input id="o-code" value={d.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} required className="[&_input]:font-mono [&_input]:text-xs" /></FormField>
            <FormField label="Outlet name" htmlFor="o-name"><Input id="o-name" value={d.name} onChange={(e) => set({ name: e.target.value })} required /></FormField>
          </div>
          <FormField label="Address" htmlFor="o-addr"><Input id="o-addr" value={d.address} onChange={(e) => set({ address: e.target.value })} required /></FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="City" htmlFor="o-city"><Input id="o-city" value={d.city} onChange={(e) => set({ city: e.target.value })} required /></FormField>
            <FormField label="Province" htmlFor="o-prov"><Input id="o-prov" value={d.province} onChange={(e) => set({ province: e.target.value })} required /></FormField>
            <FormField label="Phone" htmlFor="o-phone"><Input id="o-phone" value={d.phone} onChange={(e) => set({ phone: e.target.value })} /></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <FormField label="Latitude" htmlFor="o-lat"><Input id="o-lat" type="number" step="0.0001" value={d.lat} onChange={(e) => set({ lat: Number(e.target.value) })} required /></FormField>
            <FormField label="Longitude" htmlFor="o-lng"><Input id="o-lng" type="number" step="0.0001" value={d.lng} onChange={(e) => set({ lng: Number(e.target.value) })} required /></FormField>
            <FormField label="Opens" htmlFor="o-open"><Input id="o-open" type="time" value={d.openTime} onChange={(e) => set({ openTime: e.target.value })} required /></FormField>
            <FormField label="Closes" htmlFor="o-close"><Input id="o-close" type="time" value={d.closeTime} onChange={(e) => set({ closeTime: e.target.value })} required /></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Time zone"><Select value={d.timezone} onValueChange={(v) => set({ timezone: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Google Maps link" htmlFor="o-maps" hint="Leave empty to build from coordinates"><Input id="o-maps" value={d.mapsUrl} onChange={(e) => set({ mapsUrl: e.target.value })} /></FormField>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onClose()}>Cancel</Button><Button type="submit">{d.id ? 'Save changes' : 'Create outlet'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
