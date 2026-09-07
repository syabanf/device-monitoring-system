import { metaRaw } from './data';
import type { FixtureMeta } from '@monitoring/types';

export const meta = metaRaw as FixtureMeta;
/** The fixed "current time" all fixture-relative formatting is computed against. */
export const FIXTURE_NOW = meta.fixtureNow;
export const FIXTURE_NOW_MS = Date.parse(FIXTURE_NOW);
export const TZ_LABEL = 'WIB';

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@indomaret.co.id', token: 'admin123' },
  employee: { email: 'user123@indomaret.co.id', token: '9634871231' },
  technician: { email: 'tech@wit.id', token: '2468013579' },
} as const;
