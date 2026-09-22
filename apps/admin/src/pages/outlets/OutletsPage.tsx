import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Outlet } from '@monitoring/types';
import { Badge, Button, Card, DataTable, Input, PageHeader, type Column } from '@monitoring/ui';
import { isSolved } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';
import { DeviceStatusBadge } from '../../components/badges';
import { OutletDialog, emptyOutlet } from '../../components/master/OutletDialog';
import { ConfirmDelete } from '../../components/master/ConfirmDelete';

export function OutletsPage() {
  const { outlets, alerts, employees, devicesByOutlet, distributorId, dispatch } = useScoped();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const setQ = (value: string) => { const next = new URLSearchParams(params); value ? next.set('q', value) : next.delete('q'); setParams(next, { replace: true }); };
  const [editing, setEditing] = React.useState<Outlet | null>(null);
  const [removing, setRemoving] = React.useState<Outlet | null>(null);

  const openByOutlet = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) if (!isSolved(a)) m.set(a.outletId, (m.get(a.outletId) ?? 0) + 1);
    return m;
  }, [alerts]);
  const staffByOutlet = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employees) for (const oid of e.outletIds) m.set(oid, (m.get(oid) ?? 0) + 1);
    return m;
  }, [employees]);

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? outlets.filter((o) => o.name.toLowerCase().includes(s) || o.code.toLowerCase().includes(s) || o.address.toLowerCase().includes(s)) : outlets;
  }, [outlets, q]);

  const columns: Column<Outlet>[] = [
    { key: 'code', header: 'Code', cell: (o) => <span className="font-mono text-xs">{o.code}</span>, sortValue: (o) => o.code },
    { key: 'name', header: 'Outlet', cell: (o) => <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted">{o.address}</p></div>, sortValue: (o) => o.name },
    { key: 'hours', header: 'Hours', cell: (o) => <span className="tabular-nums">{o.openTime}–{o.closeTime}</span> },
    {
      key: 'devices', header: 'Devices',
      cell: (o) => {
        const devs = devicesByOutlet.get(o.id) ?? [];
        const offline = devs.filter((d) => d.status === 'offline').length;
        return <div className="flex items-center gap-2"><span>{devs.length}</span>{offline ? <DeviceStatusBadge status="offline" /> : null}</div>;
      },
      sortValue: (o) => (devicesByOutlet.get(o.id) ?? []).length,
    },
    { key: 'staff', header: 'Employees', cell: (o) => staffByOutlet.get(o.id) ?? 0, sortValue: (o) => staffByOutlet.get(o.id) ?? 0 },
    {
      key: 'open', header: 'Open alerts',
      cell: (o) => { const n = openByOutlet.get(o.id) ?? 0; return n ? <Badge variant="danger">{n}</Badge> : <span className="text-muted">0</span>; },
      sortValue: (o) => openByOutlet.get(o.id) ?? 0,
    },
    {
      key: 'actions', header: '', className: 'text-right',
      cell: (o) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit" onClick={() => setEditing(o)}><Pencil /></Button>
          <Button variant="ghost" size="icon" className="size-8 text-brand-600" aria-label="Delete" onClick={() => setRemoving(o)}><Trash2 /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Outlets" description={`${outlets.length} outlets under this distribution center`} actions={<><Input aria-label="Search outlets" placeholder="Search outlet, code, address" leftIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 sm:w-72 sm:flex-none" /><Button onClick={() => setEditing(emptyOutlet(distributorId, outlets.length + 1))}><Plus />Add outlet</Button></>} />
      <Card>
        <DataTable columns={columns} rows={rows} rowKey={(o) => o.id} onRowClick={(o) => navigate(`/outlets/${o.id}`)} pageSize={12} initialSort={{ key: 'code', dir: 'asc' }} emptyTitle="No outlets match" />
      </Card>
      <OutletDialog outlet={editing} onClose={() => setEditing(null)} />
      <ConfirmDelete open={!!removing} title={`Delete ${removing?.name}?`} description="Its devices, sensors, contacts, tickets and alert history will be removed." onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) dispatch({ type: 'outlets/remove', outletId: removing.id }); setRemoving(null); }} />
    </div>
  );
}
