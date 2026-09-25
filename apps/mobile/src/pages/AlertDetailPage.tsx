import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, ExternalLink, MapPin, Navigation, Phone, Play, Timer, UserRound } from 'lucide-react';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, FormField, Textarea, cn } from '@monitoring/ui';
import { fmtDateTimeLong, fmtRelativeDay, fmtTempCF, humanizeDuration, ongoingSeconds } from '@monitoring/fixtures';
import { latestReadingBySensor } from '../state/readings';
import { alertById } from '../state/lookups';
import { useAuth } from '../auth/auth';
import { useAppState, useReadAlerts } from '../state/app-state';
import { SensorIcon } from '../components/SensorIcon';
import { statusLabel } from '../components/AlertCard';
import { PhotoDropzone } from '../components/PhotoDropzone';
import { apiClient } from '../state/client';

export function AlertDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const employee = user;
  const { state, dispatch } = useAppState();
  const { markRead } = useReadAlerts();
  const alert = state.alerts.find((a) => a.id === Number(id)) ?? alertById.get(Number(id));
  const [notes, setNotes] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [saved, setSaved] = React.useState(false);
  const [photosBusy, setPhotosBusy] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => { if (alert) markRead(alert.id); }, [alert, markRead]);

  if (!alert || !employee || !employee.outletIds.includes(alert.outletId)) {
    return <div className="pt-6"><Button asChild variant="ghost"><Link to="/alerts"><ArrowLeft />Back</Link></Button><p className="mt-6 text-sm text-muted">Alert not found for your outlets.</p></div>;
  }
  const outlet = state.outlets.find((o) => o.id === alert.outletId)!;
  const device = state.devices.find((d) => d.id === alert.deviceId);
  const sensor = state.sensors.find((s) => s.id === alert.sensorId);
  const reading = sensor && sensor.type === 'TEMPERATURE_HUMIDITY' ? latestReadingBySensor.get(sensor.id) : undefined;
  const responder = alert.response ? state.employees.find((e) => e.id === alert.response!.employeeId) : undefined;
  const manager = state.contacts.find((c) => c.outletId === alert.outletId && c.isPrimary) ?? state.contacts.find((c) => c.outletId === alert.outletId);
  const responsible = state.employees.find((e) => e.id === alert.assigneeEmployeeId) ?? responder;
  const canAcknowledge = alert.status === 'UNACKNOWLEDGED' && employee.kind === 'employee';
  const canStart = alert.status === 'ACKNOWLEDGED' && employee.kind === 'employee' && alert.assigneeEmployeeId === employee.id;
  const canRespond = alert.status === 'RESPONDING' && !alert.response && employee.kind === 'employee' && alert.assigneeEmployeeId === employee.id;
  const active = alert.status === 'UNACKNOWLEDGED' || alert.status === 'ACKNOWLEDGED' || alert.status === 'RESPONDING';
  const targetSeconds = alert.category === 'SECURITY' ? 5 * 60 : 15 * 60;
  const elapsedSeconds = alert.response?.responseDurationSec ?? ongoingSeconds(alert.triggerTime, alert.clearTime);
  const overdue = active && elapsedSeconds > targetSeconds;
  const action = alert.sensorType === 'DOOR' ? 'Check the entrance and confirm it is secure.' : alert.sensorType === 'MOTION' ? 'Inspect the detected area before acknowledging.' : alert.sensorType === 'POWER' ? 'Check mains power and the AKCP unit.' : alert.sensorType === 'PANIC_BUTTON' ? 'Contact the store manager and verify staff safety.' : 'Inspect the sensor area and verify the current conditions.';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const [applied] = await dispatch({ type: 'alerts/respond', alertId: alert.id, employeeId: employee.id, notes: notes.trim(), photoUrls: photos });
    setSubmitting(false);
    // A refused claim leaves the alert as it is, and the layout shows why.
    if (applied?.type === 'alerts/replace') setSaved(true);
  };

  if (saved) return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col justify-center py-8 text-center" role="status" aria-live="polite" aria-atomic="true">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-float"><CheckCircle2 className="size-10" /></span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Response submitted</p>
      <h1 className="mt-2 text-[30px] font-bold leading-tight">Thank you, {employee.name.split(' ')[0]}.</h1>
      <p className="mx-auto mt-3 max-w-xs text-sm text-muted">Your notes{photos.length ? ` and ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''} are attached to alert #{alert.id}. The operations team can review them now.</p>
      <div className="mt-8 rounded-[24px] bg-white p-5 text-left shadow-card">
        <div className="flex items-center justify-between"><span className="text-sm text-muted">Status</span><Badge variant="success"><CheckCircle2 className="size-3" />Resolved</Badge></div>
        <p className="mt-3 text-sm font-semibold">{alert.message}</p><p className="mt-1 text-xs text-muted">{outlet.name} · {alert.sensorName}</p>
      </div>
      <div className="mt-6 space-y-3"><Button size="lg" className="w-full" onClick={() => setSaved(false)}>View submitted response</Button><Button size="lg" variant="outline" className="w-full border-0 bg-white" onClick={() => navigate('/alerts?tab=resolved')}>Back to alerts</Button></div>
    </div>
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-3">
        <button type="button" onClick={() => navigate(-1)} className="flex size-11 items-center justify-center rounded-full bg-white shadow-card active:scale-95" aria-label="Back"><ArrowLeft className="size-5" /></button>
        <div><h1 className="text-lg font-bold leading-tight">{fmtRelativeDay(alert.triggerTime)}</h1><p className="text-xs text-muted">Alert #{alert.id}</p></div>
      </header>

      <section className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-white shadow-float">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="relative flex items-start justify-between">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-600"><SensorIcon type={alert.sensorType} className="size-6" /></span>
          <Badge variant={alert.status === 'UNACKNOWLEDGED' ? 'brand' : alert.status === 'ACKNOWLEDGED' ? 'warning' : alert.status === 'RESPONDING' ? 'info' : alert.status === 'RESOLVED' ? 'success' : 'default'}>{alert.status === 'UNACKNOWLEDGED' ? <AlertTriangle className="size-3" /> : alert.status === 'ACKNOWLEDGED' ? <Eye className="size-3" /> : alert.status === 'RESPONDING' ? <Play className="size-3" /> : <CheckCircle2 className="size-3" />}{statusLabel(alert)}</Badge>
        </div>
        <p className="relative mt-4 text-xs text-sidebar-muted">{alert.sensorName}</p>
        <p className="relative text-xl font-bold leading-tight">{alert.message}</p>
        <p className="relative mt-4 text-[44px] font-bold leading-none tracking-tight">{alert.triggerValue}</p>
        <p className="relative mt-1 text-xs text-sidebar-muted">{!active && alert.clearTime ? `Condition ended after ${humanizeDuration(ongoingSeconds(alert.triggerTime, alert.clearTime))}` : `Ongoing for ${humanizeDuration(ongoingSeconds(alert.triggerTime))}`}</p>
      </section>

      <section className={cn('rounded-[24px] p-5', alert.category === 'SECURITY' ? 'bg-brand-50' : 'bg-sky-100')}>
        <div className="flex items-start gap-3"><span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', alert.category === 'SECURITY' ? 'bg-brand-600 text-white' : 'bg-sky-500 text-white')}><AlertTriangle className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{alert.category === 'SECURITY' ? 'High priority' : 'Action required'}</p><Badge variant={overdue ? 'brand' : 'outline'}>{alert.category === 'SECURITY' ? 'Respond within 5 min' : 'Respond within 15 min'}</Badge></div><p className="mt-1 text-sm text-body">{action}</p></div></div>
        <div className={cn('mt-4 flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2.5 text-sm font-semibold', overdue && 'text-brand-600')}><Timer className="size-4" />{active ? overdue ? `Overdue by ${humanizeDuration(elapsedSeconds - targetSeconds)}` : `${humanizeDuration(targetSeconds - elapsedSeconds)} remaining` : `Resolved after ${humanizeDuration(elapsedSeconds)}`}</div>
      </section>

      <section className="rounded-[24px] bg-white p-5 shadow-card" aria-live="polite" aria-atomic="true">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-surface text-body"><UserRound className="size-5" /></span><div><p className="text-xs text-muted">Responsible</p><p className="text-sm font-bold">{responsible ? responsible.id === employee.id ? 'You' : responsible.name : 'Not yet assigned'}</p></div></div>
        {canAcknowledge ? <Button size="lg" className="mt-4 w-full" onClick={() => dispatch({ type: 'alerts/acknowledge', alertId: alert.id, employeeId: employee.id })}><Eye />Acknowledge alert</Button> : null}
        {canStart ? <Button size="lg" className="mt-4 w-full" onClick={() => dispatch({ type: 'alerts/startResponse', alertId: alert.id, employeeId: employee.id })}><Play />Start site inspection</Button> : null}
        {active && responsible && responsible.id !== employee.id ? <p className="mt-3 rounded-2xl bg-surface p-3 text-xs text-body">{responsible.name} has taken responsibility. You can follow progress here; no duplicate response is needed.</p> : null}
        {alert.status === 'RESPONDING' && responsible?.id === employee.id ? <p className="mt-3 text-xs text-muted">Inspection started. Complete the field report below when the situation is safe.</p> : null}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild size="lg" variant="outline" className="border-0 bg-white shadow-card"><a href={`tel:${manager?.phone ?? outlet.phone}`}><Phone />Call manager</a></Button>
        <Button asChild size="lg" variant="outline" className="border-0 bg-white shadow-card"><a href={outlet.mapsUrl} target="_blank" rel="noreferrer"><Navigation />Directions</a></Button>
      </div>

      <dl className="divide-y divide-border rounded-[24px] bg-white px-5 py-1 shadow-card">
        <Row label="Location"><span className="font-medium">{outlet.name}</span><a href={outlet.mapsUrl} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{outlet.address}<ExternalLink className="size-3" /></a></Row>
        <Row label="Device"><span className="font-mono text-xs">{device?.serial} - {device?.mac}</span></Row>
        <Row label="Sensor">{alert.sensorName} · {SENSOR_TYPE_LABEL[alert.sensorType]}{sensor ? ` · ${sensor.portKind} port ${sensor.portIndex}` : ''}</Row>
        {reading ? <Row label="Latest Reading">{fmtTempCF(reading.temperatureC)} · {reading.humidityPct.toFixed(0)} %RH<span className="block text-xs text-muted">on {fmtDateTimeLong(reading.at)}</span></Row> : null}
        <Row label="Triggered At">{fmtDateTimeLong(alert.triggerTime)}</Row>
        <Row label="Acknowledgement">{alert.acknowledgedAt ? `${responsible?.name ?? 'Outlet employee'} · ${fmtDateTimeLong(alert.acknowledgedAt)}` : 'Not acknowledged'}</Row>
        {alert.respondingAt ? <Row label="Response Started">{fmtDateTimeLong(alert.respondingAt)}</Row> : null}
        {alert.resolvedAt ? <Row label="Resolved At">{fmtDateTimeLong(alert.resolvedAt)}</Row> : null}
        {alert.verifiedAt ? <Row label="Verified At">{fmtDateTimeLong(alert.verifiedAt)}</Row> : null}
        {alert.clearTime ? <Row label="Cleared At">{fmtDateTimeLong(alert.clearTime)} · {alert.clearValue}</Row> : <Row label="Ongoing For">{humanizeDuration(ongoingSeconds(alert.triggerTime))}</Row>}
      </dl>

      {alert.response && responder ? (
        <section className="rounded-[24px] bg-sky-100 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={responder.name} color={responder.avatarColor} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{responder.id === employee.id ? 'You responded' : `Responded by ${responder.name}`}</p>
              <p className="text-xs text-body/70">{fmtDateTimeLong(alert.response.respondedAt)} · {humanizeDuration(alert.response.responseDurationSec)} after trigger</p>
            </div>
          </div>
          {alert.response.notes ? <p className="mt-3 text-sm text-body">{alert.response.notes}</p> : null}
          {alert.response.photoUrls.length ? <div className="mt-3 grid grid-cols-3 gap-2">{alert.response.photoUrls.map((u) => <img key={u} src={apiClient.url(u)} alt="Proof" className="aspect-square w-full rounded-2xl object-cover" />)}</div> : null}
          {responder.id !== employee.id ? <p className="mt-3 text-xs text-body/70">Another employee at this outlet already responded, so no second response is needed.</p> : null}
        </section>
      ) : null}

      {canRespond ? (
        <form onSubmit={(e) => void save(e)} className="space-y-5 pb-28">
          <div className="rounded-[24px] bg-white p-5 shadow-card">
            <h2 className="text-base font-bold">Your response</h2>
            <p className="mt-0.5 text-xs text-muted">Check the sensor location, then report what you found.</p>
            <FormField label="Notes" htmlFor="notes" className="mt-4"><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you find at the sensor location?" className="min-h-32 border-0 bg-surface" required /></FormField>
            <p className="mb-2 mt-4 text-sm font-medium">Upload Photos</p>
            <PhotoDropzone urls={photos} onChange={setPhotos} onBusyChange={setPhotosBusy} />
          </div>
          <div className="safe-b fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-5 pb-5">
            <div className="flex gap-3 rounded-full bg-white/90 p-2 shadow-float backdrop-blur">
              <Button type="button" variant="ghost" size="lg" className="flex-1 text-brand-600" onClick={() => navigate('/alerts')}>Cancel</Button>
              <Button type="submit" size="lg" className="flex-[1.6]" disabled={photosBusy} loading={submitting}>{photosBusy ? 'Uploading photos…' : 'Submit response'}</Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 py-3.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
