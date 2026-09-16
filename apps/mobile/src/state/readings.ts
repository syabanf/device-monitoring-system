import type { Reading } from '@monitoring/types';

// The newest sample per sensor, loaded with the rest of the session's outlets.
let latest = new Map<string, Reading>();

export function setLatestReadings(readings: Reading[]) {
  latest = new Map(readings.map((r) => [r.sensorId, r]));
}

export const latestReadingBySensor = {
  get: (sensorId: string): Reading | undefined => latest.get(sensorId),
};
