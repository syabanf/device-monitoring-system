import * as React from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, ShieldCheck, Thermometer, Wifi } from 'lucide-react';
import { BrandMark, Button, FormField, Input } from '@monitoring/ui';
import { DEMO_ACCOUNTS } from '@monitoring/fixtures';
import { useAuth } from '../auth/auth';

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState<string>(DEMO_ACCOUNTS.admin.email);
  const [token, setToken] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [params] = useSearchParams();
  // magic-link login: /login?email=…&password=…&next=/path (admin invite links, demos)
  React.useEffect(() => {
    const e = params.get('email'); const t = params.get('password') ?? params.get('token');
    if (e && t) void signIn(e, t, params.get('next') ?? '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(mail: string, secret: string, next: string) {
    setBusy(true);
    const r = await login(mail, secret);
    setBusy(false);
    if (r.ok) navigate(next, { replace: true });
    else setError(r.error);
  }

  if (session) return <Navigate to={params.get('next') ?? '/'} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    void signIn(email, token, (location.state as { from?: string } | null)?.from ?? '/');
  };

  return (
    <div className="grid grid-cols-1 min-h-dvh bg-surface p-3 lg:grid-cols-[1.1fr_1fr] lg:p-4">
      <div className="hidden flex-col justify-between rounded-[28px] bg-ink p-10 text-white shadow-float lg:flex">
        <BrandMark plate className="self-start [&_img]:w-40" />
        <div>
          <p className="text-sm font-medium text-sidebar-muted">Realtime environment monitoring</p>
          <h1 className="mt-3 text-5xl font-bold leading-[1.05] tracking-tight">Every outlet,<br />monitored<span className="text-brand-600">.</span></h1>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[{ icon: Thermometer, t: 'Temp & RH', d: '24/7 trend log' }, { icon: ShieldCheck, t: 'Security', d: 'door & motion' }, { icon: Wifi, t: 'No SIM card', d: 'building internet' }].map((f) => (
              <div key={f.t} className="rounded-2xl bg-white/5 p-4">
                <f.icon className="size-5 text-brand-500" />
                <p className="mt-3 text-sm font-semibold">{f.t}</p>
                <p className="text-xs text-sidebar-muted">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-muted">Outlet environment monitoring · built by WIT.ID</p>
      </div>
      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><BrandMark className="w-36" /></div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back<span className="text-brand-600">.</span></h2>
          <p className="mt-2 text-sm text-muted">Sign in to the distributor admin dashboard.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <FormField label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </FormField>
            <FormField label="Password" htmlFor="token" error={error ?? undefined} hint={`Demo password: ${DEMO_ACCOUNTS.admin.token}`}>
              <Input
                id="token" type={show ? 'text' : 'password'} autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} error={!!error} required
                rightSlot={<button type="button" onClick={() => setShow((s) => !s)} className="rounded-full p-1.5 text-muted hover:text-foreground" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>}
              />
            </FormField>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
