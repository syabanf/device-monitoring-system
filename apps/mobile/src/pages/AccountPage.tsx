import * as React from 'react';
import { useNavigate } from 'react-router';
import { Download, LogOut, MapPin, Phone, ShieldCheck, Smartphone } from 'lucide-react';
import { EMPLOYEE_ROLE_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button } from '@monitoring/ui';
import { fmtDate } from '@monitoring/fixtures';
import { outletById } from '../state/lookups';
import { useAuth } from '../auth/auth';
import { Wrench } from 'lucide-react';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function AccountPage() {
  const { user, logout } = useAuth();
  const employee = user;
  const navigate = useNavigate();
  const [install, setInstall] = React.useState<BIP | null>(null);
  const [standalone] = React.useState(() => window.matchMedia('(display-mode: standalone)').matches);
  React.useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstall(e as BIP); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!employee) return null;
  return (
    <div className="space-y-5">
      <header className="pt-3"><h1 className="text-[28px] font-bold leading-tight tracking-tight">Account<span className="text-brand-600">.</span></h1><p className="mt-0.5 text-sm text-muted">Your registered device and outlets</p></header>
      <section className="flex flex-col items-center rounded-[28px] bg-ink p-7 text-center text-white shadow-float">
        <Avatar name={employee.name} color={employee.avatarColor} size="xl" className="ring-4 ring-white/10" />
        <p className="mt-4 text-xl font-bold">{employee.name}</p>
        <p className="text-sm text-sidebar-muted">{employee.kind === 'technician' ? `Technician · ${employee.technician?.specialty}` : EMPLOYEE_ROLE_LABEL[employee.employee!.role]}</p>
        {employee.kind === 'employee' ? <Badge variant={employee.employee!.registrationStatus === 'approved' ? 'success' : 'warning'} dot className="mt-3">{employee.employee!.registrationStatus === 'approved' ? 'Registered device' : 'Pending approval'}</Badge> : <Badge variant="info" className="mt-3"><Wrench className="size-3" />Maintenance team</Badge>}
      </section>
      <section className="divide-y divide-border rounded-[24px] bg-white px-5 py-1 shadow-card">
        <Row icon={<Phone />} label="Phone">{employee.phone}</Row>
        <Row icon={<Smartphone />} label="Email">{employee.email}</Row>
        <Row icon={<MapPin />} label="Outlets"><div className="flex flex-wrap gap-1">{employee.kind === 'technician' ? <Badge variant="outline">{employee.outletIds.length} outlets in distribution center</Badge> : employee.outletIds.map((id) => <Badge key={id} variant="outline">{outletById.get(id)?.name}</Badge>)}</div></Row>
        {employee.kind === 'employee' ? <Row icon={<ShieldCheck />} label="Approved">{employee.employee!.approvedAt ? fmtDate(employee.employee!.approvedAt) : '—'}</Row> : null}
      </section>
      {!standalone ? (
        <section className="flex items-center gap-3 rounded-[24px] bg-sky-100 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sky-500"><Download className="size-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Install the app</p><p className="text-xs text-body/70">{install ? 'Add to your home screen for instant alerts.' : 'Use your browser menu → "Add to Home screen".'}</p></div>
          {install ? <Button size="sm" onClick={async () => { await install.prompt(); setInstall(null); }}>Install</Button> : null}
        </section>
      ) : null}
      <Button variant="outline" size="lg" className="w-full border-0 bg-white text-brand-600 shadow-card" onClick={() => { logout(); navigate('/login'); }}><LogOut />Sign out</Button>
      <p className="text-center text-[11px] text-muted">RA Monitor · v0.1.0 · WIT.ID</p>
    </div>
  );
}
function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3.5 text-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted [&_svg]:size-4">{icon}</span>
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}
