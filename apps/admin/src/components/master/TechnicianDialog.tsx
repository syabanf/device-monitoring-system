import * as React from 'react';
import type { Technician } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, BRAND } from '@monitoring/ui';
import { generateToken, newId } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';

const SPECIALTIES = ['AKCP hardware', 'Network & connectivity', 'Sensor calibration', 'Electrical & power'];
export const emptyTechnician = (distributorId: string): Technician => ({ id: '', distributorId, name: '', phone: '', specialty: SPECIALTIES[0]!, avatarColor: BRAND.ink, email: '', registrationToken: generateToken() });

export function TechnicianDialog({ technician, onClose }: { technician: Technician | null; onClose: () => void }) {
  const { dispatch } = useScoped();
  const [d, setD] = React.useState<Technician | null>(technician);
  React.useEffect(() => setD(technician), [technician]);
  if (!d) return <Dialog open={false} />;
  const set = (patch: Partial<Technician>) => setD({ ...d, ...patch });
  const submit = (e: React.FormEvent) => { e.preventDefault(); dispatch({ type: 'technicians/upsert', technician: { ...d, id: d.id || newId('tech'), name: d.name.trim(), email: d.email.trim().toLowerCase() } }); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{d.id ? 'Edit technician' : 'Add technician'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Full name" htmlFor="t-name"><Input id="t-name" value={d.name} onChange={(e) => set({ name: e.target.value })} required /></FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Email" htmlFor="t-email"><Input id="t-email" type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} required /></FormField>
            <FormField label="Phone" htmlFor="t-phone"><Input id="t-phone" value={d.phone} onChange={(e) => set({ phone: e.target.value })} required /></FormField>
          </div>
          <FormField label="Specialty"><Select value={d.specialty} onValueChange={(v) => set({ specialty: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...new Set([...SPECIALTIES, d.specialty])].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Mobile app token" htmlFor="t-token" hint="Technicians sign in to the mobile app with email + token"><div className="flex gap-2"><Input id="t-token" value={d.registrationToken} onChange={(e) => set({ registrationToken: e.target.value })} className="flex-1 [&_input]:font-mono" /><Button type="button" variant="outline" onClick={() => set({ registrationToken: generateToken() })}>Regenerate</Button></div></FormField>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{d.id ? 'Save changes' : 'Create technician'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
