import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, ExternalLink, MapPin, Phone, Play, Wrench } from 'lucide-react';
import { MAINTENANCE_TYPE_LABEL, TICKET_STATUS_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, FormField, Textarea, cn } from '@monitoring/ui';
import { fmtDateTimeLong, isTicketOverdue, outletById, technicianById } from '@monitoring/fixtures';
import { useAuth } from '../auth/auth';
import { useAppState } from '../state/app-state';
import { PhotoDropzone } from '../components/PhotoDropzone';

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const ticket = state.tickets.find((t) => t.id === id);
  const [notes, setNotes] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [completing, setCompleting] = React.useState(false);
  if (!ticket || !user || !user.outletIds.includes(ticket.outletId)) {
    return <div className="pt-6"><Button asChild variant="ghost"><Link to="/maintenance"><ArrowLeft />Back</Link></Button><p className="mt-6 text-sm text-muted">Ticket not found.</p></div>;
  }
  const outlet = outletById.get(ticket.outletId)!;
  const device = state.devices.find((d) => d.id === ticket.deviceId);
  const tech = ticket.technicianId ? technicianById.get(ticket.technicianId) : undefined;
  const isTech = user.kind === 'technician';
  const mine = isTech && ticket.technicianId === user.id;
  const overdue = isTicketOverdue(ticket);

  const complete = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'tickets/setStatus', ticketId: ticket.id, status: 'DONE', notes, photoUrls: photos });
    setCompleting(false);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-3">
        <button type="button" onClick={() => navigate(-1)} className="flex size-11 items-center justify-center rounded-full bg-white shadow-card active:scale-95" aria-label="Back"><ArrowLeft className="size-5" /></button>
        <div><h1 className="text-lg font-bold leading-tight">{ticket.id}</h1><p className="text-xs text-muted">{MAINTENANCE_TYPE_LABEL[ticket.type]}</p></div>
      </header>

      <section className={cn('relative overflow-hidden rounded-[28px] p-6 text-white shadow-float', ticket.status === 'DONE' ? 'bg-ink' : overdue || ticket.priority === 'CRITICAL' ? 'bg-brand-600' : 'bg-ink')}>
        <div className="relative flex items-start justify-between">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15"><Wrench className="size-6" /></span>
          <div className="flex gap-1.5"><Badge variant="outline" className="border-white/30 capitalize text-white">{ticket.priority.toLowerCase()}</Badge><Badge variant="outline" className="border-white/30 text-white">{overdue ? 'Overdue' : TICKET_STATUS_LABEL[ticket.status]}</Badge></div>
        </div>
        <p className="relative mt-5 text-[22px] font-bold leading-tight">{ticket.title}</p>
        <p className="relative mt-2 text-sm text-white/80">{ticket.description}</p>
      </section>

      <dl className="divide-y divide-border rounded-[24px] bg-white px-5 py-1 shadow-card">
        <Row label="Outlet"><span className="font-medium">{outlet.name}</span><a href={outlet.mapsUrl} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{outlet.address}<ExternalLink className="size-3" /></a></Row>
        <Row label="Device"><span className="font-mono text-xs">{device?.serial ?? '—'}</span>{device ? <span className="block text-xs text-muted">Room Alert {device.model.replace('RA', '')} · {device.status}</span> : null}</Row>
        <Row label="Scheduled">{ticket.scheduledAt ? fmtDateTimeLong(ticket.scheduledAt) : <span className="text-muted">Not scheduled</span>}</Row>
        <Row label="Created">{fmtDateTimeLong(ticket.createdAt)}</Row>
        {ticket.completedAt ? <Row label="Completed">{fmtDateTimeLong(ticket.completedAt)}</Row> : null}
        <Row label="Technician">{tech ? <span className="flex items-center gap-2"><Avatar name={tech.name} color={tech.avatarColor} size="sm" />{tech.name}{!isTech ? <a href={`tel:${tech.phone}`} className="ml-auto flex size-8 items-center justify-center rounded-full bg-surface text-ink" aria-label="Call technician"><Phone className="size-4" /></a> : null}</span> : <span className="text-muted">Unassigned</span>}</Row>
        {ticket.partsUsed.length ? <Row label="Parts">{ticket.partsUsed.join(', ')}</Row> : null}
      </dl>

      {ticket.notes || ticket.photoUrls.length ? (
        <section className="rounded-[24px] bg-sky-100 p-5">
          <p className="text-sm font-semibold">Work notes</p>
          {ticket.notes ? <p className="mt-2 text-sm text-body">{ticket.notes}</p> : null}
          {ticket.photoUrls.length ? <div className="mt-3 grid grid-cols-3 gap-2">{ticket.photoUrls.map((u) => <img key={u} src={u.startsWith('blob:') || u.startsWith('data:') ? u : `/${u}`} alt="Work proof" className="aspect-square w-full rounded-2xl object-cover" />)}</div> : null}
        </section>
      ) : null}

      {isTech && ticket.status !== 'DONE' ? (
        <div className="space-y-3">
          {!mine ? <Button size="lg" variant="outline" className="w-full border-0 bg-white shadow-card" onClick={() => dispatch({ type: 'tickets/assign', ticketId: ticket.id, technicianId: user.id })}>Assign to me</Button> : null}
          {ticket.status !== 'IN_PROGRESS' ? <Button size="lg" variant="secondary" className="w-full" onClick={() => dispatch({ type: 'tickets/setStatus', ticketId: ticket.id, status: 'IN_PROGRESS' })}><Play />Start work</Button> : null}
          {!completing ? <Button size="lg" className="w-full" onClick={() => setCompleting(true)}><Check />Complete ticket</Button> : (
            <form onSubmit={complete} className="space-y-4 rounded-[24px] bg-white p-5 shadow-card">
              <h2 className="text-base font-bold">Completion report</h2>
              <FormField label="Work notes" htmlFor="tnotes"><Textarea id="tnotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done, parts replaced, readings verified…" className="min-h-28 border-0 bg-surface" required /></FormField>
              <div><p className="mb-2 text-sm font-medium">Photos</p><PhotoDropzone urls={photos} onChange={setPhotos} /></div>
              <div className="flex gap-3"><Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setCompleting(false)}>Cancel</Button><Button type="submit" size="lg" className="flex-[1.6]"><Check />Mark done</Button></div>
            </form>
          )}
        </div>
      ) : null}
      {!isTech && ticket.status !== 'DONE' ? <p className="text-center text-xs text-muted">A technician will visit your outlet. You will see the status update here.</p> : null}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[96px_1fr] gap-3 py-3.5 text-sm"><dt className="text-muted">{label}</dt><dd className="min-w-0 break-words">{children}</dd></div>;
}
