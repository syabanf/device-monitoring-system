import { Link } from 'react-router';
import { Wrench } from 'lucide-react';
import type { MaintenanceTicket } from '@monitoring/types';
import { MAINTENANCE_TYPE_LABEL, TICKET_STATUS_LABEL } from '@monitoring/types';
import { fmtDate, fmtRelativeDay, isTicketOverdue } from '@monitoring/fixtures';
import { outletById, technicianById } from '../state/lookups';
import { Avatar, cn } from '@monitoring/ui';

export function TicketCard({ ticket }: { ticket: MaintenanceTicket }) {
  const overdue = isTicketOverdue(ticket);
  const tech = ticket.technicianId ? technicianById.get(ticket.technicianId) : undefined;
  const tone = ticket.status === 'DONE' ? 'bg-surface text-muted' : ticket.priority === 'CRITICAL' || overdue ? 'bg-brand-600 text-white' : ticket.status === 'IN_PROGRESS' ? 'bg-amber-400 text-ink' : 'bg-ink text-white';
  return (
    <Link to={`/maintenance/${ticket.id}`} className={cn('block rounded-[24px] p-4 shadow-card transition-transform active:scale-[0.98]', ticket.status === 'DONE' ? 'bg-white/70' : 'bg-white')}>
      <div className="flex items-center gap-3.5">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', tone)}><Wrench className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">{ticket.id}</span>
            <span className={cn('text-[11px] font-semibold', overdue ? 'text-brand-600' : ticket.status === 'IN_PROGRESS' ? 'text-amber-600' : ticket.status === 'DONE' ? 'text-muted' : 'text-sky-500')}>{overdue ? 'Overdue' : TICKET_STATUS_LABEL[ticket.status]}</span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">{outletById.get(ticket.outletId)?.name?.replace('Indomaret ', 'IDM ')} · {MAINTENANCE_TYPE_LABEL[ticket.type]}</p>
        </div>
      </div>
      <p className="mt-3 text-[15px] font-semibold leading-snug">{ticket.title}</p>
      <div className="mt-2.5 flex items-center justify-between text-xs text-muted">
        <span>{ticket.scheduledAt ? `Scheduled ${fmtDate(ticket.scheduledAt)}` : `Created ${fmtRelativeDay(ticket.createdAt)}`} · <span className="capitalize">{ticket.priority.toLowerCase()}</span></span>
        {tech ? <span className="flex items-center gap-1.5"><Avatar name={tech.name} color={tech.avatarColor} size="sm" className="size-5 text-[8px]" />{tech.name.split(' ')[0]}</span> : <span>Unassigned</span>}
      </div>
    </Link>
  );
}
