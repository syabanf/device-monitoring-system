import { Link } from 'react-router';
import { Calendar, MapPin, Wrench } from 'lucide-react';
import type { MaintenanceTicket, TicketStatus } from '@monitoring/types';
import { MAINTENANCE_TYPE_LABEL, TICKET_STATUS_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, KeyValue, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@monitoring/ui';
import { fmtDateTime, isTicketOverdue } from '@monitoring/fixtures';
import { deviceById, sensorById } from '../../state/lookups';
import { outletById, technicianById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { PriorityBadge, TicketStatusBadge } from '../../components/badges';

const FLOW: TicketStatus[] = ['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'DONE'];

export function TicketSheet({ ticket, onClose }: { ticket: MaintenanceTicket | null; onClose: () => void }) {
  const { technicians, dispatch } = useScoped();
  const device = ticket ? deviceById.get(ticket.deviceId) : undefined;
  const outlet = ticket ? outletById.get(ticket.outletId) : undefined;
  const sensor = ticket?.sensorId ? sensorById.get(ticket.sensorId) : undefined;
  const tech = ticket?.technicianId ? technicianById.get(ticket.technicianId) : undefined;
  const nextStatus = ticket ? FLOW[FLOW.indexOf(ticket.status) + 1] : undefined;
  return (
    <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {ticket ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><Wrench className="size-5" /></span>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{ticket.title}</SheetTitle>
                  <p className="text-xs text-muted">{ticket.id} · {MAINTENANCE_TYPE_LABEL[ticket.type]} · created {fmtDateTime(ticket.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2"><TicketStatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} />{isTicketOverdue(ticket) ? <Badge variant="brand">Overdue</Badge> : null}</div>
            </SheetHeader>
            <SheetBody>
              <p className="text-sm text-body">{ticket.description}</p>
              <dl className="mt-4 divide-y divide-border">
                <KeyValue label="Outlet"><Link to={`/outlets/${ticket.outletId}`} className="font-medium text-brand-600 hover:underline">{outlet?.name}</Link><p className="flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{outlet?.address}</p></KeyValue>
                <KeyValue label="Device"><Link to={`/devices/${ticket.deviceId}`} className="font-mono text-xs hover:underline">{device?.serial}</Link>{sensor ? <p className="text-xs text-muted">Sensor: {sensor.name}</p> : null}</KeyValue>
                <KeyValue label="Scheduled">{ticket.scheduledAt ? <span className="flex items-center gap-1.5"><Calendar className="size-4 text-muted" />{fmtDateTime(ticket.scheduledAt)}</span> : <span className="text-muted">Not scheduled</span>}</KeyValue>
                {ticket.completedAt ? <KeyValue label="Completed">{fmtDateTime(ticket.completedAt)}</KeyValue> : null}
                {ticket.partsUsed.length ? <KeyValue label="Parts"><div className="flex flex-wrap gap-1">{ticket.partsUsed.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}</div></KeyValue> : null}
                {ticket.notes ? <KeyValue label="Notes">{ticket.notes}</KeyValue> : null}
              </dl>
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold">Assignment</h4>
                <Select value={ticket.technicianId ?? 'none'} onValueChange={(v) => dispatch({ type: 'tickets/assign', ticketId: ticket.id, technicianId: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Assign technician" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Unassigned</SelectItem>{technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.specialty}</SelectItem>)}</SelectContent>
                </Select>
                {tech ? <div className="flex items-center gap-3 rounded-2xl bg-surface p-3"><Avatar name={tech.name} color={tech.avatarColor} /><div><p className="text-sm font-semibold">{tech.name}</p><p className="text-xs text-muted">{tech.specialty} · {tech.phone}</p></div></div> : null}
                <h4 className="pt-2 text-sm font-semibold">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {FLOW.map((s) => <Button key={s} size="sm" variant={ticket.status === s ? 'secondary' : 'outline'} onClick={() => dispatch({ type: 'tickets/setStatus', ticketId: ticket.id, status: s })}>{TICKET_STATUS_LABEL[s]}</Button>)}
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
              {nextStatus ? <Button onClick={() => dispatch({ type: 'tickets/setStatus', ticketId: ticket.id, status: nextStatus })}>Move to {TICKET_STATUS_LABEL[nextStatus]}</Button> : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
