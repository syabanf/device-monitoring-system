import * as React from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Check } from 'lucide-react';
import type { MaintenanceTicket, MaintenanceType, TicketPriority } from '@monitoring/types';
import { MAINTENANCE_TYPE_LABEL } from '@monitoring/types';
import { Button, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, cn } from '@monitoring/ui';
import { FIXTURE_NOW, nextTicketId, outletById } from '@monitoring/fixtures';
import { useAuth } from '../auth/auth';
import { useAppState, useMobileScope } from '../state/app-state';

const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function ReportIssuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const { devices } = useMobileScope(user?.outletIds ?? []);
  const [deviceId, setDeviceId] = React.useState(devices[0]?.id ?? '');
  const [type, setType] = React.useState<MaintenanceType>('CORRECTIVE');
  const [priority, setPriority] = React.useState<TicketPriority>('MEDIUM');
  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [done, setDone] = React.useState<string | null>(null);
  if (!user) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;
    const ticket: MaintenanceTicket = { id: nextTicketId(state.tickets), distributorId: user.distributorId, outletId: device.outletId, deviceId: device.id, sensorId: null, type, priority, status: 'OPEN', title: title.trim(), description: `${desc.trim()}\n\nReported by ${user.name} (${user.phone}) via mobile app.`, technicianId: null, createdAt: FIXTURE_NOW, scheduledAt: null, completedAt: null, partsUsed: [], notes: null, photoUrls: [] };
    dispatch({ type: 'tickets/create', ticket });
    setDone(ticket.id);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-3">
        <button type="button" onClick={() => navigate(-1)} className="flex size-11 items-center justify-center rounded-full bg-white shadow-card active:scale-95" aria-label="Back"><ArrowLeft className="size-5" /></button>
        <div><h1 className="text-lg font-bold leading-tight">Report an issue</h1><p className="text-xs text-muted">Creates a maintenance ticket for the admin</p></div>
      </header>
      {done ? (
        <div className="space-y-4">
          <div className="rounded-[28px] bg-ink p-6 text-white shadow-float"><span className="flex size-12 items-center justify-center rounded-full bg-emerald-500"><Check className="size-6" /></span><p className="mt-4 text-xl font-bold">Ticket {done} created</p><p className="mt-1 text-sm text-white/70">The distribution center will assign a technician. You can follow the status under Maintenance.</p></div>
          <Button size="lg" className="w-full" onClick={() => navigate(`/maintenance/${done}`)}>View ticket</Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate('/maintenance')}>Back to maintenance</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-4 rounded-[24px] bg-white p-5 shadow-card">
            <FormField label="Device"><Select value={deviceId} onValueChange={setDeviceId}><SelectTrigger className="h-12"><SelectValue placeholder="Choose device" /></SelectTrigger><SelectContent>{devices.map((d) => <SelectItem key={d.id} value={d.id}>{outletById.get(d.outletId)?.name?.replace('Indomaret ', '')} · {d.serial}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Issue type"><Select value={type} onValueChange={(v) => setType(v as MaintenanceType)}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{(['CORRECTIVE', 'REPLACEMENT', 'FIRMWARE', 'PREVENTIVE'] as MaintenanceType[]).map((k) => <SelectItem key={k} value={k}>{MAINTENANCE_TYPE_LABEL[k]}</SelectItem>)}</SelectContent></Select></FormField>
            <div>
              <p className="mb-1.5 text-sm font-medium">Priority</p>
              <div className="grid grid-cols-4 gap-2">{PRIORITIES.map((p) => <button key={p} type="button" onClick={() => setPriority(p)} className={cn('h-10 rounded-full text-xs font-semibold capitalize', priority === p ? (p === 'CRITICAL' ? 'bg-brand-600 text-white' : 'bg-ink text-white') : 'bg-surface text-body')}>{p.toLowerCase()}</button>)}</div>
            </div>
            <FormField label="Title" htmlFor="r-title"><Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Door sensor keeps triggering" required className="[&_input]:h-12 [&_input]:bg-surface [&_input]:border-0" /></FormField>
            <FormField label="Describe the problem" htmlFor="r-desc"><Textarea id="r-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="When did it start? Which sensor? Any error light on the unit?" className="min-h-28 border-0 bg-surface" required /></FormField>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!deviceId}>Submit ticket</Button>
        </form>
      )}
    </div>
  );
}
