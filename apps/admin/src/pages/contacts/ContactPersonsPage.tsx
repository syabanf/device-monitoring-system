import * as React from 'react';
import { useSearchParams } from 'react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ContactPerson } from '@monitoring/types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle, Avatar, Badge, Button, Card, DataTable, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Toggle, BRAND, type Column } from '@monitoring/ui';
import { outletById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';

const EMPTY = (outletId: string): ContactPerson => ({ id: '', outletId, name: '', phone: '', email: null, role: 'Area Supervisor', isPrimary: false, channels: ['app'] });

export function ContactPersonsPage() {
  const { contacts, outlets, dispatch } = useScoped();
  const [params, setParams] = useSearchParams();
  const outletFilter = outlets.some((o) => o.id === params.get('outlet')) ? params.get('outlet')! : 'all';
  const [editing, setEditing] = React.useState<ContactPerson | null>(null);
  const [removing, setRemoving] = React.useState<ContactPerson | null>(null);

  const rows = React.useMemo(() => (outletFilter === 'all' ? contacts : contacts.filter((c) => c.outletId === outletFilter)), [contacts, outletFilter]);

  const columns: Column<ContactPerson>[] = [
    { key: 'name', header: 'Name', cell: (c) => <div className="flex items-center gap-3"><Avatar name={c.name} color={BRAND.ink} size="sm" /><div><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{c.role}</p></div></div>, sortValue: (c) => c.name },
    { key: 'outlet', header: 'Outlet', cell: (c) => outletById.get(c.outletId)?.name ?? '—', sortValue: (c) => outletById.get(c.outletId)?.name ?? '' },
    { key: 'phone', header: 'Phone', cell: (c) => <span className="tabular-nums">{c.phone}</span> },
    { key: 'email', header: 'Email', cell: (c) => c.email ?? <span className="text-muted">—</span> },
    { key: 'channels', header: 'Channels', cell: (c) => <div className="flex gap-1">{c.channels.map((ch) => <Badge key={ch} variant={ch === 'telegram' ? 'info' : 'default'} className="capitalize">{ch}</Badge>)}</div> },
    { key: 'primary', header: 'Primary', cell: (c) => (c.isPrimary ? <Badge variant="brand">Primary</Badge> : null), sortValue: (c) => (c.isPrimary ? 1 : 0) },
    {
      key: 'actions', header: '', className: 'text-right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit" onClick={() => setEditing(c)}><Pencil /></Button>
          <Button variant="ghost" size="icon" className="size-8 text-brand-600" aria-label="Delete" onClick={() => setRemoving(c)}><Trash2 /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contact Persons"
        description="People to call and notify when an outlet alert needs escalation"
        actions={
          <>
            <Select value={outletFilter} onValueChange={(v) => { const next = new URLSearchParams(params); v === 'all' ? next.delete('outlet') : next.set('outlet', v); setParams(next, { replace: true }); }}>
              <SelectTrigger className="w-full sm:w-60"><SelectValue placeholder="All outlets" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All outlets</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => setEditing(EMPTY(outletFilter === 'all' ? (outlets[0]?.id ?? '') : outletFilter))}><Plus />Add contact</Button>
          </>
        }
      />
      <Card><DataTable columns={columns} rows={rows} rowKey={(c) => c.id} pageSize={12} initialSort={{ key: 'outlet', dir: 'asc' }} emptyTitle="No contact persons" /></Card>

      <ContactDialog contact={editing} outlets={outlets} onClose={() => setEditing(null)} onSave={(c) => { dispatch({ type: 'contacts/upsert', contact: c }); setEditing(null); }} />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
          <AlertDialogDescription>They will stop receiving alert broadcasts for {removing ? outletById.get(removing.outletId)?.name : ''}. This only affects the current session.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (removing) dispatch({ type: 'contacts/remove', contactId: removing.id }); setRemoving(null); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ContactDialog({ contact, outlets, onClose, onSave }: { contact: ContactPerson | null; outlets: { id: string; name: string }[]; onClose: () => void; onSave: (c: ContactPerson) => void }) {
  const [draft, setDraft] = React.useState<ContactPerson | null>(contact);
  React.useEffect(() => setDraft(contact), [contact]);
  if (!draft) return <Dialog open={false} />;
  const set = (patch: Partial<ContactPerson>) => setDraft({ ...draft, ...patch });
  const telegram = draft.channels.includes('telegram');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...draft, id: draft.id || `cp-${Date.now()}`, email: draft.email?.trim() || null });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{draft.id ? 'Edit contact' : 'Add contact'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Full name" htmlFor="cp-name"><Input id="cp-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} required /></FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Phone" htmlFor="cp-phone"><Input id="cp-phone" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} required /></FormField>
            <FormField label="Email" htmlFor="cp-email"><Input id="cp-email" type="email" value={draft.email ?? ''} onChange={(e) => set({ email: e.target.value })} /></FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Outlet">
              <Select value={draft.outletId} onValueChange={(v) => set({ outletId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Role">
              <Select value={draft.role} onValueChange={(v) => set({ role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Area Supervisor', 'Field Coordinator', 'Store Manager', 'Security Officer'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface p-3">
            <div><p className="text-sm font-medium">Primary contact</p><p className="text-xs text-muted">First to be called for this outlet</p></div>
            <Toggle checked={draft.isPrimary} onCheckedChange={(v) => set({ isPrimary: v })} label="Primary contact" />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface p-3">
            <div><p className="text-sm font-medium">Telegram broadcast</p><p className="text-xs text-muted">Also receive ANBot broadcast messages</p></div>
            <Toggle checked={telegram} onCheckedChange={(v) => set({ channels: v ? ['app', 'telegram'] : ['app'] })} label="Telegram broadcast" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save contact</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
