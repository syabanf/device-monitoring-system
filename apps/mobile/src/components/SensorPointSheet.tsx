import type { Sensor } from '@monitoring/types';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SensorPointCard } from '@monitoring/ui';
import { fmtAgo, sensorPoint } from '@monitoring/fixtures';
import { latestReadingBySensor } from '../state/readings';

/** Tapping a point on the device list opens its dials, its limits and its open alerts. */
export function SensorPointSheet({ sensor, openAlerts = 0, onClose }: { sensor: Sensor | null; openAlerts?: number; onClose: () => void }) {
  if (!sensor) return null;
  const reading = latestReadingBySensor.get(sensor.id);
  const point = sensorPoint(sensor, reading, openAlerts);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-md">
        <SheetHeader><SheetTitle>{sensor.name}</SheetTitle></SheetHeader>
        <SheetBody>
          <SensorPointCard
            {...point}
            name={point.kindLabel.split(' · ')[0]!}
            kindLabel={`${sensor.portKind} port ${sensor.portIndex}`}
            className="bg-surface shadow-none"
            footer={
              <span className="flex items-center justify-between gap-2">
                <span>{reading ? `Updated ${fmtAgo(reading.at)}` : point.state ? 'Reported by the unit on change' : 'Waiting for the first push'}</span>
                {openAlerts ? <span className="font-semibold text-brand-600">{openAlerts} open alert{openAlerts > 1 ? 's' : ''}</span> : null}
              </span>
            }
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
