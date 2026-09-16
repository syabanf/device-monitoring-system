import { metaRaw } from './data';
import type { FixtureMeta } from '@monitoring/types';

export const meta = metaRaw as FixtureMeta;
/** The instant the generator froze the fixtures at. The seeder shifts every row forward by
 * (now - fixtureNow), so the app reads its clock from the wall instead. */
export const FIXTURE_NOW = meta.fixtureNow;
export const nowIso = (): string => new Date().toISOString();
export const nowMs = (): number => Date.now();
export const TZ_LABEL = 'WIB';

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@indomaret.co.id', token: 'admin123' },
  employee: { email: 'user123@indomaret.co.id', token: '9634871231' },
  technician: { email: 'tech@wit.id', token: '2468013579' },
} as const;
