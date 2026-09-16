import type { Sensor } from '@monitoring/types';
import { SENSOR_STATE_LABEL, SENSOR_TYPE_LABEL } from '@monitoring/types';
import { fmtAgo, outsideLimits } from '@monitoring/fixtures';
import { latestReadingBySensor } from '../state/readings';
import { Badge, cn } from '@monitoring/ui';
import { SensorIcon } from './badges';

export function sensorLatestText(s: Sensor): { value: string; at: string | null; alarm: boolean } {
  if (s.type === 'TEMPERATURE_HUMIDITY' || s.type === 'TEMPERATURE') {
    const r = latestReadingBySensor.get(s.id);
    if (!r) return { value: '—', at: null, alarm: false };
    const alarm = outsideLimits(s, r);
    return { value: `${r.temperatureC.toFixed(1)} °C · ${r.humidityPct.toFixed(0)} %RH`, at: r.at, alarm };
  }
  return { value: SENSOR_STATE_LABEL[s.type]?.normal ?? 'Normal', at: null, alarm: false };
}

export function SensorRow({ sensor, openAlerts = 0, className }: { sensor: Sensor; openAlerts?: number; className?: string }) {
  const latest = sensorLatestText(sensor);
  return (
    <div className={cn('flex items-center gap-3 py-2.5', className)}>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', openAlerts ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>
        <SensorIcon type={sensor.type} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{sensor.name}</p>
        <p className="truncate text-xs text-muted">{SENSOR_TYPE_LABEL[sensor.type]} · {sensor.portKind} port {sensor.portIndex}</p>
      </div>
      <div className="text-right">
        <p className={cn('text-sm font-semibold tabular-nums', latest.alarm && 'text-red-700')}>{latest.value}</p>
        <p className="text-xs text-muted">{latest.at ? fmtAgo(latest.at) : openAlerts ? <Badge variant="danger">{openAlerts} open</Badge> : 'normal'}</p>
      </div>
    </div>
  );
}
