import * as React from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, WitMark } from '@monitoring/ui';
import { DEMO_ACCOUNTS } from '@monitoring/fixtures';
import { useAuth } from '../auth/auth';
import { PhoneFrame } from '../layouts/MobileLayout';

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState<string>(DEMO_ACCOUNTS.employee.email);
  const [token, setToken] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [params] = useSearchParams();
  // magic-link login: /login?email=…&token=…&next=/path (admin invite links, demos)
  React.useEffect(() => {
    const e = params.get('email'); const t = params.get('token');
    if (e && t) { const r = login(e, t); if (r.ok) navigate(params.get('next') ?? '/', { replace: true }); else setError(r.error); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [forgot, setForgot] = React.useState(false);
  if (session) return <Navigate to={params.get('next') ?? '/'} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = login(email, token);
    if (r.ok) navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    else setError(r.error);
  };

  return (
    <PhoneFrame>
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col bg-surface px-6 pb-10 pt-16">
      <WitMark className="text-2xl" />
      <div className="mt-10">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">Welcome back<span className="text-brand-600">.</span></h1>
        <p className="mt-2 text-sm text-muted">Login below, or contact admin for registration.</p>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <FormField label="Email" htmlFor="email"><Input id="email" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="[&_input]:h-13 [&_input]:border-0 [&_input]:shadow-card" /></FormField>
        <FormField label="Token" htmlFor="token" error={error ?? undefined} hint={`Demo employee: ${DEMO_ACCOUNTS.employee.email} / ${DEMO_ACCOUNTS.employee.token} · technician: ${DEMO_ACCOUNTS.technician.email} / ${DEMO_ACCOUNTS.technician.token}`}>
          <Input id="token" type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="one-time-code" value={token} onChange={(e) => setToken(e.target.value)} error={!!error} required className="[&_input]:h-13 [&_input]:border-0 [&_input]:shadow-card"
            rightSlot={<button type="button" onClick={() => setShow((s) => !s)} className="rounded-full p-1.5 text-muted" aria-label={show ? 'Hide token' : 'Show token'}>{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>} />
        </FormField>
        <Button type="submit" size="lg" className="mt-2 w-full">Sign In</Button>
        <button type="button" onClick={() => setForgot(true)} className="mx-auto block text-sm font-medium text-muted underline underline-offset-4">Forgot Password</button>
      </form>
      <p className="mt-auto pt-10 text-center text-[11px] text-muted">WIT.ID · Realtime Environment Monitoring</p>
      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Need a new token?</DialogTitle><DialogDescription>Tokens are issued by your distribution center admin. Ask them to generate a new registration token from User Management, then sign in with it here.</DialogDescription></DialogHeader>
          <DialogFooter><Button onClick={() => setForgot(false)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PhoneFrame>
  );
}
