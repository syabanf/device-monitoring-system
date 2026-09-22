import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LayoutList, Map as MapIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import type { Device } from '@monitoring/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, FloorLegend, FloorPlan, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, type Column } from '@monitoring/ui';
import { useFloorMarkers } from '../../components/useFloorMarkers';
import { fmtAgo } from '@monitoring/fixtures';
import { outletById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { DeviceStatusBadge } from '../../components/badges';
import { DeviceDialog } from '../../components/master/DeviceDialog';
import { AddDeviceDialog } from '../../components/AddDeviceDialog';
import { ConfirmDelete } from '../../components/master/ConfirmDelete';

export function DevicesPage() {
  const { devices: all, sensorsByDevice, outlets, dispatch } = useScoped();
  const [params, setParams] = useSearchParams();
  const mode: 'table' | 'floor' = params.get('view') === 'floor' ? 'floor' : 'table';
  const floorOutlet = outlets.some((o) => o.id === params.get('outlet')) ? params.get('outlet')! : outlets[0]?.id ?? '';
  const update = (patch: Record<string, string | null>) => { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(patch)) value == null ? next.delete(key) : next.set(key, value); setParams(next, { replace: true }); };
  const [markerId, setMarkerId] = React.useState<string | null>(null);
  const floorMarkers = useFloorMarkers(floorOutlet);
  const [editing, setEditing] = React.useState<Device | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<Device | null>(null);
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const status = (params.get('status') === 'online' || params.get('status') === 'offline' ? params.get('status') : 'all') as 'all' | 'online' | 'offline';
  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((d) => (status === 'all' || d.status === status) && (!s || d.serial.toLowerCase().includes(s) || d.mac.toLowerCase().includes(s) || (outletById.get(d.outletId)?.name.toLowerCase().includes(s) ?? false)));
  }, [all, q, status]);

  const columns: Column<Device>[] = [
    { key: 'serial', header: 'Device', cell: (d) => <div><p className="font-mono text-xs font-semibold">{d.serial}</p><p className="font-mono text-[11px] text-muted">{d.mac}</p></div>, sortValue: (d) => d.serial },
    { key: 'model', header: 'Model', cell: (d) => `Room Alert ${d.model.replace('RA', '')}`, sortValue: (d) => d.model },
    { key: 'outlet', header: 'Outlet', cell: (d) => outletById.get(d.outletId)?.name ?? d.outletId, sortValue: (d) => outletById.get(d.outletId)?.name ?? '' },
    { key: 'ip', header: 'IP', cell: (d) => <span className="font-mono text-xs">{d.ip}</span> },
    { key: 'sensors', header: 'Sensors', cell: (d) => (sensorsByDevice.get(d.id) ?? []).length, sortValue: (d) => (sensorsByDevice.get(d.id) ?? []).length },
    { key: 'status', header: 'Status', cell: (d) => <DeviceStatusBadge status={d.status} />, sortValue: (d) => d.status },
    { key: 'push', header: 'Last push', cell: (d) => fmtAgo(d.lastPushAt), sortValue: (d) => d.lastPushAt },
    {
      key: 'actions', header: '', className: 'text-right',
      cell: (d) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit" onClick={() => setEditing(d)}><Pencil /></Button>
          <Button variant="ghost" size="icon" className="size-8 text-brand-600" aria-label="Delete" onClick={() => setRemoving(d)}><Trash2 /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Devices"
        description={`${all.length} Room Alert units · ${all.filter((d) => d.status === 'offline').length} offline`}
        actions={
          <>
            <Select value={status} onValueChange={(v) => update({ status: v === 'all' ? null : v })}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="offline">Offline</SelectItem></SelectContent>
            </Select>
            <Input aria-label="Search devices" placeholder="Search serial, MAC, outlet" leftIcon={<Search />} value={q} onChange={(e) => update({ q: e.target.value || null })} className="min-w-0 flex-1 sm:w-72 sm:flex-none" />
            <Button onClick={() => setAdding(true)}><Plus />Add device</Button>
          </>
        }
      />
      <div className="mb-4 inline-flex rounded-full bg-white p-1 shadow-card">
        {([['table', 'Table', LayoutList], ['floor', 'Shopfloor', MapIcon]] as const).map(([m, label, Icon]) => (
          <button key={m} type="button" onClick={() => update({ view: m === 'table' ? null : m })} className={cn('inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors', mode === m ? 'bg-ink text-white' : 'text-muted hover:text-foreground')}><Icon className="size-4" />{label}</button>
        ))}
      </div>
      {mode === 'table' ? (
        <Card>
          <DataTable columns={columns} rows={rows} rowKey={(d) => d.id} onRowClick={(d) => navigate(`/devices/${d.id}`)} pageSize={12} emptyTitle="No devices match" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div><CardTitle>Installation points</CardTitle><p className="text-sm text-muted">Where each unit and sensor sits inside the outlet</p></div>
              <Select value={floorOutlet} onValueChange={(v) => { update({ outlet: v }); setMarkerId(null); }}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
            </CardHeader>
            <CardContent><FloorPlan markers={floorMarkers} selectedId={markerId} onSelect={setMarkerId} title="Denah outlet" /><FloorLegend className="mt-3" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Units at this outlet</CardTitle><Button asChild variant="outline" size="sm"><Link to={`/shopfloor?outlet=${floorOutlet}`}><MapIcon />Full shopfloor</Link></Button></CardHeader>
            <CardContent className="space-y-2">
              {all.filter((d) => d.outletId === floorOutlet).map((d) => (
                <div key={d.id} className={cn('rounded-2xl p-3', markerId === d.id ? 'bg-ink text-white' : 'bg-surface-2')}>
                  <button type="button" onClick={() => setMarkerId(d.id)} className="flex w-full items-center gap-3 text-left">
                    <span className="min-w-0 flex-1"><span className="block font-mono text-xs font-semibold">{d.serial}</span><span className={cn('block text-xs', markerId === d.id ? 'text-white/70' : 'text-muted')}>Room Alert {d.model.replace('RA', '')} · x {d.floor.x}% y {d.floor.y}%</span></span>
                    <DeviceStatusBadge status={d.status} />
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(sensorsByDevice.get(d.id) ?? []).map((s) => <button key={s.id} type="button" onClick={() => setMarkerId(s.id)} className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', markerId === s.id ? 'bg-brand-600 text-white' : markerId === d.id ? 'bg-white/10 text-white' : 'bg-white text-body shadow-card')}>{s.name}</button>)}
                  </div>
                  <div className="mt-2 flex gap-2"><Button asChild size="sm" variant={markerId === d.id ? 'outline' : 'ghost'} className={markerId === d.id ? 'border-white/20 text-white hover:bg-white/10' : ''}><Link to={`/devices/${d.id}`}>Detail</Link></Button><Button size="sm" variant="ghost" className={markerId === d.id ? 'text-white hover:bg-white/10' : ''} onClick={() => setEditing(d)}><Pencil />Position</Button></div>
                </div>
              ))}
              {all.filter((d) => d.outletId === floorOutlet).length === 0 ? <p className="text-sm text-muted">No devices installed here yet. <Badge variant="outline">Add device</Badge> to register one.</p> : null}
            </CardContent>
          </Card>
        </div>
      )}
      <DeviceDialog device={editing} onClose={() => setEditing(null)} />
      <AddDeviceDialog open={adding} onClose={() => setAdding(false)} />
      <ConfirmDelete open={!!removing} title={`Remove ${removing?.serial}?`} description="The unit, its sensors and its maintenance tickets will be removed." onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) dispatch({ type: 'devices/remove', deviceId: removing.id }); setRemoving(null); }} />
    </div>
  );
}
