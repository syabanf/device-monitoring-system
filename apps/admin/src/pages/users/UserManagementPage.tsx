import * as React from 'react';
import { useSearchParams } from 'react-router';
import { Check, Copy, KeyRound, MoreHorizontal, Pencil, Plus, Search, ShieldOff, Trash2 } from 'lucide-react';
import type { Employee } from '@monitoring/types';
import { EMPLOYEE_ROLE_LABEL } from '@monitoring/types';
import {
  Avatar, Badge, Button, Card, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, type Column,
} from '@monitoring/ui';
import { fmtDate, generateToken, maskToken } from '@monitoring/fixtures';
import { outletById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { RegistrationBadge } from '../../components/badges';
import { EmployeeDialog, emptyEmployee } from '../../components/master/EmployeeDialog';
import { ConfirmDelete } from '../../components/master/ConfirmDelete';

export function UserManagementPage() {
  const { employees, outlets, distributorId, dispatch } = useScoped();
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [removing, setRemoving] = React.useState<Employee | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('status') === 'pending' || params.get('status') === 'approved' ? params.get('status') : 'all') as 'all' | 'pending' | 'approved';
  const outletFilter = outlets.some((o) => o.id === params.get('outlet')) ? params.get('outlet')! : 'all';
  const q = params.get('q') ?? '';
  const update = (patch: Record<string, string | null>) => { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(patch)) value == null ? next.delete(key) : next.set(key, value); setParams(next, { replace: true }); };
  const [tokenFor, setTokenFor] = React.useState<Employee | null>(null);

  // The API issues the token, so the dialog shows what it wrote rather than a local guess.
  const issueToken = async (employee: Employee) => {
    const [applied] = await dispatch({ type: 'employees/generateToken', employeeId: employee.id, token: generateToken() });
    if (applied?.type === 'employees/upsert') setTokenFor(applied.employee);
  };

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees.filter((e) => (tab === 'all' || e.registrationStatus === tab) && (outletFilter === 'all' || e.outletIds.includes(outletFilter)) && (!s || e.name.toLowerCase().includes(s) || e.phone.includes(s) || e.email.includes(s)));
  }, [employees, tab, outletFilter, q]);
  const pendingCount = employees.filter((e) => e.registrationStatus === 'pending').length;

  const columns: Column<Employee>[] = [
    { key: 'name', header: 'Employee', cell: (e) => <div className="flex items-center gap-3"><Avatar name={e.name} color={e.avatarColor} size="sm" /><div><p className="font-medium">{e.name}</p><p className="text-xs text-muted">{e.email}</p></div></div>, sortValue: (e) => e.name },
    { key: 'role', header: 'Role', cell: (e) => EMPLOYEE_ROLE_LABEL[e.role], sortValue: (e) => e.role },
    { key: 'outlet', header: 'Outlet', cell: (e) => <div className="flex flex-wrap gap-1">{e.outletIds.map((id) => <Badge key={id} variant="outline">{outletById.get(id)?.name}</Badge>)}</div> },
    { key: 'phone', header: 'Phone', cell: (e) => <span className="tabular-nums">{e.phone}</span> },
    { key: 'token', header: 'Token', cell: (e) => <span className="font-mono text-xs">{maskToken(e.registrationToken)}</span> },
    { key: 'status', header: 'Status', cell: (e) => <RegistrationBadge status={e.registrationStatus} />, sortValue: (e) => e.registrationStatus },
    { key: 'since', header: 'Registered', cell: (e) => (e.registeredAt ? fmtDate(e.registeredAt) : '—'), sortValue: (e) => e.registeredAt ?? '' },
    {
      key: 'actions', header: '', className: 'text-right',
      cell: (e) => (
        <div className="flex justify-end gap-1">
          {e.registrationStatus === 'pending' && e.registrationToken ? <Button size="sm" onClick={() => dispatch({ type: 'employees/approve', employeeId: e.id })}><Check />Approve</Button> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(e)}><Pencil />Edit employee</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void issueToken(e)}><KeyRound />Generate new token</DropdownMenuItem>
              {e.registrationToken ? <DropdownMenuItem onSelect={() => setTokenFor(e)}><Copy />Show token</DropdownMenuItem> : null}
              <DropdownMenuItem destructive onSelect={() => dispatch({ type: 'employees/revoke', employeeId: e.id })}><ShieldOff />Revoke access</DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => setRemoving(e)}><Trash2 />Delete employee</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Employees who receive alerts and respond from the mobile app"
        actions={
          <>
            <Select value={outletFilter} onValueChange={(v) => update({ outlet: v === 'all' ? null : v })}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All outlets</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input aria-label="Search employees" placeholder="Search name, phone, email" leftIcon={<Search />} value={q} onChange={(e) => update({ q: e.target.value || null })} className="min-w-0 flex-1 sm:w-64 sm:flex-none" />
            <Button onClick={() => setEditing(emptyEmployee(distributorId, outletFilter === 'all' ? (outlets[0]?.id ?? '') : outletFilter))}><Plus />Add employee</Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => update({ status: v === 'all' ? null : v })} className="mb-4">
        <TabsList variant="pill">
          <TabsTrigger value="all">All ({employees.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({employees.length - pendingCount})</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card><DataTable columns={columns} rows={rows} rowKey={(e) => e.id} pageSize={12} emptyTitle="No employees match" /></Card>

      <TokenDialog employee={tokenFor} onClose={() => setTokenFor(null)} />
      <EmployeeDialog employee={editing} onClose={() => setEditing(null)} />
      <ConfirmDelete open={!!removing} title={`Delete ${removing?.name}?`} description="They will lose mobile app access and be removed from their outlets." onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) dispatch({ type: 'employees/remove', employeeId: removing.id }); setRemoving(null); }} />
    </div>
  );
}

function TokenDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const token = employee?.registrationToken ?? '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <Dialog open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Registration token</DialogTitle>
          <DialogDescription>Share this token with {employee?.name}. They sign in to the mobile app with their email and this token.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white">
          <span className="font-mono text-2xl font-bold tracking-[0.2em]">{token}</span>
          <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</Button>
        </div>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
