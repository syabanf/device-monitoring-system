import { Link } from 'react-router';
import { Check, ExternalLink, ImageOff, ShieldCheck } from 'lucide-react';
import type { Alert } from '@monitoring/types';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Avatar, Badge, Button, KeyValue, Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@monitoring/ui';
import { fmtDateTimeLong, fmtTempCF, humanizeDuration, ongoingSeconds } from '@monitoring/fixtures';
import { deviceById, outletById, sensorById } from '../../state/lookups';
import { latestReadingBySensor } from '../../state/readings';
import { apiClient } from '../../state/client';
import { useScoped } from '../../state/app-state';
import { AlertStatusBadge, CategoryBadge, SensorIcon } from '../../components/badges';

export function AlertDetailDrawer({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  const { dispatch, employees } = useScoped();
  const outlet = alert ? outletById.get(alert.outletId) : undefined;
  const device = alert ? deviceById.get(alert.deviceId) : undefined;
  const sensor = alert ? sensorById.get(alert.sensorId) : undefined;
  const reading = sensor && (sensor.type === 'TEMPERATURE_HUMIDITY' || sensor.type === 'TEMPERATURE') ? latestReadingBySensor.get(sensor.id) : undefined;
  const responder = alert?.response ? employees.find((employee) => employee.id === alert.response!.employeeId) : undefined;
  const responsible = alert ? employees.find((employee) => employee.id === alert.assigneeEmployeeId) ?? employees.find((employee) => employee.primaryOutletId === alert.outletId) : undefined;
  const severity = alert?.category === 'SECURITY' ? 'High' : 'Medium';
  const nextAction = !alert ? '' : alert.status === 'UNACKNOWLEDGED' ? 'An outlet employee must acknowledge and inspect the sensor.' : alert.status === 'ACKNOWLEDGED' ? 'The responsible employee should begin the site inspection.' : alert.status === 'RESPONDING' ? 'Wait for the field report and photo evidence.' : alert.status === 'RESOLVED' ? 'Review the response and verify the resolution.' : 'No further action is required.';

  return (
    <Sheet open={!!alert} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {alert ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-brand-600 text-white"><SensorIcon type={alert.sensorType} className="size-5" /></span>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{alert.message}</SheetTitle>
                  <p className="text-xs text-muted">Alert #{alert.id} · {fmtDateTimeLong(alert.triggerTime)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" aria-live="polite"><AlertStatusBadge status={alert.status} /><CategoryBadge category={alert.category} /><Badge variant={severity === 'High' ? 'brand' : 'warning'}>{severity} severity</Badge>{alert.channels.includes('telegram') ? <Badge variant="info">Telegram broadcast</Badge> : null}</div>
            </SheetHeader>
            <SheetBody>
              <dl className="divide-y divide-border">
                <KeyValue label="Location">
                  <Link to={`/outlets/${alert.outletId}`} className="font-medium text-brand-600 hover:underline">{outlet?.name}</Link>
                  <p className="text-xs text-muted">{outlet?.address}</p>
                  {outlet ? <a href={outlet.mapsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"><ExternalLink className="size-3" />Google Maps</a> : null}
                </KeyValue>
                <KeyValue label="Device"><Link to={`/devices/${alert.deviceId}`} className="font-mono text-xs hover:underline">{device?.serial} · {device?.mac}</Link></KeyValue>
                <KeyValue label="Sensor">{alert.sensorName} · {SENSOR_TYPE_LABEL[alert.sensorType]}{sensor ? ` · ${sensor.portKind} port ${sensor.portIndex}` : ''}</KeyValue>
                <KeyValue label="Responsible">{responsible ? <span className="font-medium">{responsible.name}<span className="block text-xs text-muted">{responsible.phone}</span></span> : <span className="font-medium text-brand-600">Awaiting assignment</span>}</KeyValue>
                <KeyValue label="Next action"><span className="font-medium">{nextAction}</span></KeyValue>
                <KeyValue label="Trigger value"><span className="font-semibold text-brand-600">{alert.triggerValue}</span></KeyValue>
                {reading ? <KeyValue label="Latest reading">{fmtTempCF(reading.temperatureC)} · {reading.humidityPct.toFixed(0)} %RH<br /><span className="text-xs text-muted">on {fmtDateTimeLong(reading.at)}</span></KeyValue> : null}
                <KeyValue label="Triggered at">{fmtDateTimeLong(alert.triggerTime)}</KeyValue>
                <KeyValue label="Acknowledgement">{alert.acknowledgedAt ? `${responsible?.name ?? 'Outlet employee'} · ${fmtDateTimeLong(alert.acknowledgedAt)}` : <span className="font-medium text-brand-700">Not acknowledged</span>}</KeyValue>
                {alert.respondingAt ? <KeyValue label="Response started">{fmtDateTimeLong(alert.respondingAt)}</KeyValue> : null}
                {alert.resolvedAt ? <KeyValue label="Resolved at">{fmtDateTimeLong(alert.resolvedAt)}</KeyValue> : null}
                {alert.verifiedAt ? <KeyValue label="Verified at">{fmtDateTimeLong(alert.verifiedAt)}</KeyValue> : null}
                {(alert.status === 'RESOLVED' || alert.status === 'VERIFIED') && alert.clearTime ? (
                  <>
                    <KeyValue label="Cleared at">{fmtDateTimeLong(alert.clearTime)}</KeyValue>
                    <KeyValue label="Clear value">{alert.clearValue}</KeyValue>
                    <KeyValue label="Duration">{humanizeDuration(ongoingSeconds(alert.triggerTime, alert.clearTime))}</KeyValue>
                  </>
                ) : (
                  <KeyValue label="Ongoing for">{humanizeDuration(ongoingSeconds(alert.triggerTime))}</KeyValue>
                )}
              </dl>

              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold">Field response</h4>
                {alert.response && responder ? (
                  <div className="rounded-2xl bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={responder.name} color={responder.avatarColor} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{responder.name}</p>
                        <p className="text-xs text-muted">Responded {fmtDateTimeLong(alert.response.respondedAt)}</p>
                      </div>
                      <Badge variant="success">{humanizeDuration(alert.response.responseDurationSec)}</Badge>
                    </div>
                    <p className="mt-3 text-sm">{alert.response.notes}</p>
                    {alert.response.photoUrls.length ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {alert.response.photoUrls.map((u) => <img key={u} src={apiClient.url(u)} alt="Proof" className="aspect-[4/3] w-full rounded-xl object-cover" />)}
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><ImageOff className="size-3.5" />No photo proof attached</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">No employee has responded yet. Employees at {outlet?.name} were notified on the app{alert.channels.includes('telegram') ? ' and Telegram' : ''}.</div>
                )}
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
              {alert.status !== 'RESOLVED' && alert.status !== 'VERIFIED' ? <Button onClick={() => dispatch({ type: 'alerts/clear', alertId: alert.id })}><Check />Mark resolved</Button> : null}
              {alert.status === 'RESOLVED' ? <Button onClick={() => dispatch({ type: 'alerts/verify', alertId: alert.id })}><ShieldCheck />Verify resolution</Button> : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
