import type { Sensor } from '@monitoring/types';
import { SensorPointCard } from '@monitoring/ui';
import { fmtAgo, sensorPoint } from '@monitoring/fixtures';
import { latestReadingBySensor } from '../state/readings';

/** The dials for one installed point, drawn against the limits set for it. */
export function SensorPoint({ sensor, openAlerts = 0, className }: { sensor: Sensor; openAlerts?: number; className?: string }) {
  const reading = latestReadingBySensor.get(sensor.id);
  const point = sensorPoint(sensor, reading, openAlerts);
  return (
    <SensorPointCard
      {...point}
      className={className}
      footer={
        <span className="flex items-center justify-between gap-2">
          <span>{reading ? `Updated ${fmtAgo(reading.at)}` : point.state ? 'Reported by the unit on change' : 'Waiting for the first push'}</span>
          {openAlerts ? <span className="font-semibold text-brand-600">{openAlerts} open alert{openAlerts > 1 ? 's' : ''}</span> : null}
        </span>
      }
    />
  );
}
