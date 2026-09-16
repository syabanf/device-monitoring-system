import * as React from 'react';
import type { Employee, EmployeeRole } from '@monitoring/types';
import { EMPLOYEE_ROLE_LABEL } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Toggle } from '@monitoring/ui';
import { nowIso, generateToken, newId } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';

const COLORS = ['#ed1c24', '#101112', '#1d4ed8', '#047857', '#b45309', '#6d28d9', '#0e7490', '#be185d'];
export function emptyEmployee(distributorId: string, outletId: string): Employee {
  return { id: '', distributorId, outletIds: outletId ? [outletId] : [], primaryOutletId: outletId, name: '', phone: '', email: '', role: 'staff', registrationToken: generateToken(), registrationStatus: 'pending', registeredAt: nowIso(), approvedAt: null, avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)]! };
}

export function EmployeeDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { outlets, dispatch } = useScoped();
  const [d, setD] = React.useState<Employee | null>(employee);
  React.useEffect(() => setD(employee), [employee]);
  if (!d) return <Dialog open={false} />;
  const set = (patch: Partial<Employee>) => setD({ ...d, ...patch });
  const toggleOutlet = (id: string, on: boolean) => { const ids = on ? [...new Set([...d.outletIds, id])] : d.outletIds.filter((x) => x !== id); set({ outletIds: ids, primaryOutletId: ids.includes(d.primaryOutletId) ? d.primaryOutletId : (ids[0] ?? '') }); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!d.outletIds.length) return; dispatch({ type: 'employees/upsert', employee: { ...d, id: d.id || newId('emp'), name: d.name.trim(), email: d.email.trim().toLowerCase() } }); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{d.id ? 'Edit employee' : 'Add employee'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="e-name"><Input id="e-name" value={d.name} onChange={(e) => set({ name: e.target.value })} required /></FormField>
            <FormField label="Role"><Select value={d.role} onValueChange={(v) => set({ role: v as EmployeeRole })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(EMPLOYEE_ROLE_LABEL) as EmployeeRole[]).map((r) => <SelectItem key={r} value={r}>{EMPLOYEE_ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Email" htmlFor="e-email"><Input id="e-email" type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} required /></FormField>
            <FormField label="Phone" htmlFor="e-phone"><Input id="e-phone" value={d.phone} onChange={(e) => set({ phone: e.target.value })} required /></FormField>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Outlets <span className="text-xs font-normal text-muted">(at least one)</span></p>
            <div className="grid grid-cols-1 max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {outlets.map((o) => <label key={o.id} className="flex items-center justify-between rounded-2xl bg-surface px-3 py-2"><span className="text-sm">{o.name}</span><Toggle checked={d.outletIds.includes(o.id)} onCheckedChange={(v) => toggleOutlet(o.id, v)} label={o.name} /></label>)}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Primary outlet"><Select value={d.primaryOutletId} onValueChange={(v) => set({ primaryOutletId: v })} disabled={!d.outletIds.length}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{d.outletIds.map((id) => <SelectItem key={id} value={id}>{outlets.find((o) => o.id === id)?.name}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Registration"><Select value={d.registrationStatus} onValueChange={(v) => set({ registrationStatus: v as Employee['registrationStatus'], approvedAt: v === 'approved' ? (d.approvedAt ?? nowIso()) : null })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem></SelectContent></Select></FormField>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!d.outletIds.length}>{d.id ? 'Save changes' : 'Create employee'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
