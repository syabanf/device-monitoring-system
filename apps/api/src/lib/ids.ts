import { randomBytes } from 'node:crypto';

/** Prefixed, sortable-enough ids: out-m4k1x9ab. Matches the frontend reducer's newId(). */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}
