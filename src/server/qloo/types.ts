import { z } from 'zod';

// Shapes observed in real responses from https://hackathon.api.qloo.com (2026-10-30).
// Everything optional/nullable that the API may omit, so mapping never throws on sparse venues.

const interval = z.object({
  closed: z.boolean().nullish(),
  opens: z.string().nullish(),
  closes: z.string().nullish(),
});

/** /search returns external sources as objects, /v2/insights as arrays of objects. Normalize to one object. */
const externalSource = <T extends z.ZodRawShape>(shape: T) =>
  z
    .union([z.object(shape).partial(), z.array(z.object(shape).partial())])
    .transform((v) => (Array.isArray(v) ? v[0] ?? null : v))
    .nullish();

export const qlooTagSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
});

export const qlooEntitySchema = z.object({
  entity_id: z.string(),
  name: z.string(),
  location: z.object({ lat: z.number(), lon: z.number() }).partial().nullish(),
  tags: z.array(qlooTagSchema).nullish(),
  query: z.object({ affinity: z.number().nullish(), distance: z.number().nullish() }).partial().nullish(),
  properties: z
    .object({
      address: z.string().nullish(),
      price_level: z.number().nullish(),
      is_closed: z.boolean().nullish(),
      website: z.string().nullish(),
      short_description: z.string().nullish(),
      description: z.string().nullish(),
      hours: z.record(z.string(), z.array(interval)).nullish(),
      geocode: z.object({ city: z.string().nullish() }).partial().nullish(),
    })
    .partial()
    .nullish(),
  external: z
    .object({
      resy: externalSource({ url: z.string().nullish() }),
      google_place: externalSource({ place_id: z.string().nullish() }),
    })
    .partial()
    .nullish(),
});
export type QlooEntity = z.infer<typeof qlooEntitySchema>;

// Envelopes keep entities as unknown; each entity is parsed on its own so one odd venue
// is dropped instead of failing the whole response.
export const searchResponseSchema = z.object({ results: z.array(z.unknown()) });
export const insightsResponseSchema = z.object({
  success: z.boolean().optional(),
  results: z.object({ entities: z.array(z.unknown()).default([]) }).default({ entities: [] }),
});

export function parseEntities(raw: unknown[]): QlooEntity[] {
  return raw.flatMap((e) => {
    const r = qlooEntitySchema.safeParse(e);
    return r.success ? [r.data] : [];
  });
}

export class QlooError extends Error {
  constructor(
    readonly kind: 'not_configured' | 'timeout' | 'http' | 'bad_response' | 'budget_exhausted',
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'QlooError';
  }
}
