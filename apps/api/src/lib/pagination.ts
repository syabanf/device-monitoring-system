/** Opaque cursor over a stable sort key. Keeping it opaque lets the sort change later. */
export const encodeCursor = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
export const decodeCursor = (cursor: string | undefined): string | undefined =>
  cursor ? Buffer.from(cursor, 'base64url').toString('utf8') : undefined;

/** Repos fetch limit + 1 rows; this trims the extra row into nextCursor. */
export function toPage<T>(rows: T[], limit: number, key: (row: T) => string): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  return { items, nextCursor: encodeCursor(key(items[items.length - 1]!)) };
}
