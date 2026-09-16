import { z } from 'zod';

/** ISO-8601 with offset, the only time format crossing the wire. */
export const isoDateTime = z.string().datetime({ offset: true });

/** Prefixed string id, e.g. out-k2h9, dev-91ab. */
export const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-[A-Za-z0-9_-]+$`), `expected a ${prefix}- id`);

/** RFC 7807 problem+json. Every non-2xx response uses this shape. */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.string(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof problemSchema>;

/** Cursor pagination query shared by every list endpoint. */
export const pageQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type PageQuery = z.infer<typeof pageQuery>;

export const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable(), total: z.number().int().optional() });

export const distributorParam = z.object({ distributorId: id('dst') });
