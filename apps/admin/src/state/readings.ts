import * as React from 'react';
import type { Reading } from '@monitoring/types';
import { useAppState } from './app-state';

// The newest sample per sensor, loaded with the rest of the tenant. Components read it through
// the same map shape the fixtures used, so a tile or a floor-plan marker stays a one-line lookup.
let latest = new Map<string, Reading>();

export function setLatestReadings(readings: Reading[]) {
  latest = new Map(readings.map((r) => [r.sensorId, r]));
}

export const latestReadingBySensor = {
  get: (sensorId: string): Reading | undefined => latest.get(sensorId),
};

export interface SeriesQuery {
  sensorId?: string;
  outletId?: string;
  from: string;
  to: string;
  bucket?: 'hour' | 'day' | '15m';
}

/**
 * Loads a slice of the time series on demand. Trends cover thousands of rows per outlet, so the
 * pages that draw them ask for the window they show rather than holding the whole history.
 */
export function useReadingSeries(query: SeriesQuery | null): { readings: Reading[]; loading: boolean } {
  const { api } = useAppState();
  const [readings, setReadings] = React.useState<Reading[]>([]);
  const [loading, setLoading] = React.useState(false);
  const key = query ? JSON.stringify(query) : '';

  React.useEffect(() => {
    if (!key) {
      setReadings([]);
      return;
    }
    let live = true;
    setLoading(true);
    api.readings
      .series(JSON.parse(key) as SeriesQuery)
      .then((items) => {
        if (live) setReadings(items);
      })
      .catch(() => {
        if (live) setReadings([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, key]);

  return { readings, loading };
}

/** Groups a series by sensor, which is what the trend charts and the CSV export want. */
export function bySensor(readings: Reading[]): Map<string, Reading[]> {
  const m = new Map<string, Reading[]>();
  for (const r of readings) {
    const list = m.get(r.sensorId);
    if (list) list.push(r);
    else m.set(r.sensorId, [r]);
  }
  return m;
}
