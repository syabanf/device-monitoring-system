import * as React from 'react';
import type { MaintenanceTicket, MaintenanceType, TicketPriority } from '@monitoring/types';
import { MAINTENANCE_TYPE_LABEL } from '@monitoring/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@monitoring/ui';
import { FIXTURE_NOW, nextTicketId } from '@monitoring/fixtures';
import { outletById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';

export function NewTicketDialog({ open, onClose, deviceId }: { open: boolean; onClose: () => void; deviceId?: string }) {
  const { devices, technicians, tickets, distributorId, dispatch } = useScoped();
  const [dev, setDev] = React.useState(deviceId ?? devices[0]?.id ?? '');
  const [type, setType] = React.useState<MaintenanceType>('CORRECTIVE');
  const [priority, setPriority] = React.useState<TicketPriority>('MEDIUM');
  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [tech, setTech] = React.useState('none');
  const [date, setDate] = React.useState('');
  React.useEffect(() => { if (deviceId) setDev(deviceId); }, [deviceId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const device = devices.find((d) => d.id === dev);
    if (!device) return;
    const ticket: MaintenanceTicket = {
      id: nextTicketId(tickets), distributorId, outletId: device.outletId, deviceId: device.id, sensorId: null, type, priority,
      status: date ? 'SCHEDULED' : 'OPEN', title: title.trim(), description: desc.trim(), technicianId: tech === 'none' ? null : tech,
      createdAt: FIXTURE_NOW, scheduledAt: date ? `${date}T09:00:00+07:00` : null, completedAt: null, partsUsed: [], notes: null, photoUrls: [],
    };
    dispatch({ type: 'tickets/create', ticket });
    setTitle(''); setDesc(''); setDate(''); setTech('none');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New maintenance ticket</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Device">
            <Select value={dev} onValueChange={setDev}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.serial} · {outletById.get(d.outletId)?.name}</SelectItem>)}</SelectContent></Select>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Type"><Select value={type} onValueChange={(v) => setType(v as MaintenanceType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(MAINTENANCE_TYPE_LABEL) as MaintenanceType[]).map((k) => <SelectItem key={k} value={k}>{MAINTENANCE_TYPE_LABEL[k]}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Priority"><Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TicketPriority[]).map((p) => <SelectItem key={p} value={p} className="capitalize">{p.toLowerCase()}</SelectItem>)}</SelectContent></Select></FormField>
          </div>
          <FormField label="Title" htmlFor="t-title"><Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Replace front door switch" /></FormField>
          <FormField label="Description" htmlFor="t-desc"><Textarea id="t-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What needs to be done on site?" /></FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Technician"><Select value={tech} onValueChange={setTech}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Schedule date" htmlFor="t-date" hint="Leave empty to keep it open"><Input id="t-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Create ticket</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
