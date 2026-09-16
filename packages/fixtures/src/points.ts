import type { Reading, Sensor } from '@monitoring/types';
import { SENSOR_STATE_LABEL, SENSOR_TYPE_LABEL } from '@monitoring/types';

/** The props a sensor hands to the gauge card in either app. */
export interface SensorPointProps {
  name: string;
  kindLabel: string;
  temperature?: { value: number | null; limits: { lower?: number; upper?: number } };
  humidity?: { value: number | null; limits: { lower?: number; upper?: number } };
  state?: { label: string; alarm: boolean };
}

/** Maps one installed point onto its dials: the measured values and the limits set for it. */
export function sensorPoint(sensor: Sensor, reading: Reading | undefined, openAlerts = 0): SensorPointProps {
  const words = SENSOR_STATE_LABEL[sensor.type];
  const measuresTemperature = sensor.type === 'TEMPERATURE' || sensor.type === 'TEMPERATURE_HUMIDITY';
  return {
    name: sensor.name,
    kindLabel: `${SENSOR_TYPE_LABEL[sensor.type]} · ${sensor.portKind} port ${sensor.portIndex}`,
    temperature: measuresTemperature
      ? { value: reading?.temperatureC ?? null, limits: { lower: sensor.thresholds?.min, upper: sensor.thresholds?.max } }
      : undefined,
    humidity: sensor.type === 'TEMPERATURE_HUMIDITY'
      ? { value: reading?.humidityPct ?? null, limits: { lower: sensor.thresholds?.humidityMin, upper: sensor.thresholds?.humidityMax } }
      : undefined,
    state: words ? { label: openAlerts ? words.alarm : words.normal, alarm: openAlerts > 0 } : undefined,
  };
}

/** Whether a reading sits outside the limits an admin set, on either side. */
export function outsideLimits(sensor: Sensor, reading: Reading | undefined): boolean {
  if (!reading) return false;
  const t = sensor.thresholds;
  if (!t) return false;
  if (t.max != null && reading.temperatureC > t.max) return true;
  if (t.min != null && reading.temperatureC < t.min) return true;
  if (sensor.type !== 'TEMPERATURE_HUMIDITY') return false;
  if (t.humidityMax != null && reading.humidityPct > t.humidityMax) return true;
  return t.humidityMin != null && reading.humidityPct < t.humidityMin;
}
