import 'server-only';
import { z } from 'zod';
import { CUISINE_OPTIONS } from '@/domain/cuisines';

const priceLevel = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const cuisineKey = z.string().refine((k) => CUISINE_OPTIONS.some((o) => o.key === k));
const shortText = (max: number) => z.string().trim().min(1).max(max);
// Qloo entity ids are UUIDs; reject anything else so ids can't be forged into free text.
const entityId = z.string().regex(/^[0-9A-Fa-f-]{36}$/);

export const areaSchema = z.object({
  label: shortText(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusM: z.number().int().min(300).max(25_000),
});

export const entityRefSchema = z.object({ id: entityId, name: shortText(200), address: z.string().max(300).nullable() });

export const profileInputSchema = z.object({
  displayName: shortText(40),
  area: areaSchema,
  priceMax: priceLevel.nullable(),
  excludedCuisines: z.array(cuisineKey).max(20),
  positiveEntities: z.array(entityRefSchema).max(20),
});

const memoryFields = {
  placeId: entityId.nullable(),
  name: shortText(200),
  address: z.string().trim().max(300).nullable(),
  status: z.enum(['visited', 'want_to_try', 'dismissed']),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visitCount: z.number().int().min(0).max(1000).nullable().optional(),
  rating: z.enum(['liked', 'neutral', 'disliked']).nullable().optional(),
  revisitIntent: z.boolean().nullable().optional(),
};
export const memoryInputSchema = z.object(memoryFields);
export const memoryPatchSchema = z.object(memoryFields).partial();

export const constraintsSchema = z.object({
  area: z.object({ center: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }), radiusM: z.number().int().min(300).max(25_000), label: shortText(80) }).nullable(),
  priceMax: priceLevel.nullable(),
  budgetNote: z.string().trim().max(120).nullable(),
  timeWindow: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: hhmm, end: hhmm }).nullable(),
  requireOpen: z.boolean(),
  occasion: z.enum(['friends', 'date', 'business']).nullable(),
  decisionMode: z.enum(['three', 'pick']),
  excludeVisited: z.boolean(),
  relaxations: z.array(z.enum(['expand_radius', 'raise_price', 'allow_revisits'])).max(3),
});

export const createSessionSchema = z.object({ constraints: constraintsSchema });
export const joinSessionSchema = z.object({ token: z.string().min(16).max(100), consent: z.literal(true) });
export const updateConstraintsSchema = z.object({ constraints: constraintsSchema, expectedVersion: z.number().int().min(1) });
export const confirmSchema = z.object({ expectedVersion: z.number().int().min(1) });
export const rejectSchema = z.object({ placeId: entityId, reason: z.string().trim().max(200).nullable().optional() });
export const recommendSchema = z.object({ sessionId: z.string().uuid().nullable(), idempotencyKey: z.string().uuid(), constraints: constraintsSchema.optional() });
export const feedbackSchema = z.object({
  runId: z.string().uuid(),
  placeId: entityId,
  kind: z.enum(['selected', 'visited']),
  rating: z.enum(['liked', 'neutral', 'disliked']).nullable().optional(),
  revisitIntent: z.boolean().nullable().optional(),
});
export const demoSchema = z.object({ action: z.enum(['load', 'reset']) });
