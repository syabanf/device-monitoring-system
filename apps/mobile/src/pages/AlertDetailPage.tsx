import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, ExternalLink, MapPin } from 'lucide-react';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, FormField, Textarea } from '@monitoring/ui';
import { alertById, deviceById, employeeById, fmtDateTimeLong, fmtRelativeDay, fmtTempCF, humanizeDuration, latestReadingBySensor, ongoingSeconds, outletById, sensorById } from '@monitoring/fixtures';
import { useAuth } from '../auth/auth';
import { useAppState, useReadAlerts } from '../state/app-state';
import { SensorIcon } from '../components/SensorIcon';
import { PhotoDropzone } from '../components/PhotoDropzone';

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
  React.useEffect(() => { if (alert) markRead(alert.id); }, [alert, markRead]);

  if (!alert || !employee || !employee.outletIds.includes(alert.outletId)) {
    return <div className="pt-6"><Button asChild variant="ghost"><Link to="/alerts"><ArrowLeft />Back</Link></Button><p className="mt-6 text-sm text-muted">Alert not found for your outlets.</p></div>;
  }
  const outlet = outletById.get(alert.outletId)!;
  const device = deviceById.get(alert.deviceId);
  const sensor = sensorById.get(alert.sensorId);
  const reading = sensor && sensor.type === 'TEMPERATURE_HUMIDITY' ? latestReadingBySensor.get(sensor.id) : undefined;
  const responder = alert.response ? employeeById.get(alert.response.employeeId) : undefined;
  const canRespond = alert.status === 'TRIGGERED' && !alert.response && employee.kind === 'employee';

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'alerts/respond', alertId: alert.id, employeeId: employee.id, notes: notes.trim(), photoUrls: photos });
    setSaved(true);
    setTimeout(() => navigate('/alerts'), 900);
  };

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
          <Badge variant={alert.status === 'TRIGGERED' ? 'brand' : alert.status === 'RESPONDED' ? 'info' : 'default'} dot>{alert.status === 'TRIGGERED' ? 'Needs response' : alert.status === 'RESPONDED' ? 'Responded' : 'Cleared'}</Badge>
        </div>
        <p className="relative mt-4 text-xs text-sidebar-muted">{alert.sensorName}</p>
        <p className="relative text-xl font-bold leading-tight">{alert.message}</p>
        <p className="relative mt-4 text-[44px] font-bold leading-none tracking-tight">{alert.triggerValue}</p>
        <p className="relative mt-1 text-xs text-sidebar-muted">{alert.status === 'CLEARED' && alert.clearTime ? `Cleared after ${humanizeDuration(ongoingSeconds(alert.triggerTime, alert.clearTime))}` : `Ongoing for ${humanizeDuration(ongoingSeconds(alert.triggerTime))}`}</p>
      </section>

      <dl className="divide-y divide-border rounded-[24px] bg-white px-5 py-1 shadow-card">
        <Row label="Location"><span className="font-medium">{outlet.name}</span><a href={outlet.mapsUrl} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{outlet.address}<ExternalLink className="size-3" /></a></Row>
        <Row label="Device"><span className="font-mono text-xs">{device?.serial} - {device?.mac}</span></Row>
        <Row label="Sensor">{alert.sensorName} · {SENSOR_TYPE_LABEL[alert.sensorType]}{sensor ? ` · ${sensor.portKind} port ${sensor.portIndex}` : ''}</Row>
        {reading ? <Row label="Latest Reading">{fmtTempCF(reading.temperatureC)} · {reading.humidityPct.toFixed(0)} %RH<span className="block text-xs text-muted">on {fmtDateTimeLong(reading.at)}</span></Row> : null}
        <Row label="Triggered At">{fmtDateTimeLong(alert.triggerTime)}</Row>
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
          {alert.response.photoUrls.length ? <div className="mt-3 grid grid-cols-3 gap-2">{alert.response.photoUrls.map((u) => <img key={u} src={u.startsWith('blob:') ? u : `/${u}`} alt="Proof" className="aspect-square w-full rounded-2xl object-cover" />)}</div> : null}
          {responder.id !== employee.id ? <p className="mt-3 text-xs text-body/70">Another employee at this outlet already responded, so no second response is needed.</p> : null}
        </section>
      ) : null}

      {canRespond ? (
        <form onSubmit={save} className="space-y-5 pb-28">
          <div className="rounded-[24px] bg-white p-5 shadow-card">
            <h2 className="text-base font-bold">Your response</h2>
            <p className="mt-0.5 text-xs text-muted">Check the sensor location, then report what you found.</p>
            <FormField label="Notes" htmlFor="notes" className="mt-4"><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you find at the sensor location?" className="min-h-32 border-0 bg-surface" required /></FormField>
            <p className="mb-2 mt-4 text-sm font-medium">Upload Photos</p>
            <PhotoDropzone urls={photos} onChange={setPhotos} />
          </div>
          <div className="safe-b fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-5 pb-5">
            <div className="flex gap-3 rounded-full bg-white/90 p-2 shadow-float backdrop-blur">
              <Button type="button" variant="ghost" size="lg" className="flex-1 text-brand-600" onClick={() => navigate('/alerts')}>Cancel</Button>
              <Button type="submit" size="lg" className="flex-[1.6]" disabled={saved}>{saved ? <><Check />Saved</> : 'Save Data'}</Button>
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
