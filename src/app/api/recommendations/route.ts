import type { RecommendResponse } from '@/lib/api-types';
import { AppError, ok, parseBody, withUser } from '@/server/http';
import { latestSolo, recommendForSession, recommendSolo } from '@/server/services/recommend';
import { recommendSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withUser(async (req, userId) => {
  const body = await parseBody(req, recommendSchema);
  if (body.sessionId) return ok<RecommendResponse>({ result: await recommendForSession(userId, body.sessionId, body.idempotencyKey) });
  if (!body.constraints) throw new AppError('invalid_input');
  return ok<RecommendResponse>({ result: await recommendSolo(userId, body.idempotencyKey, body.constraints, body.rejectedPlaceIds ?? []) });
});

/** Latest solo result for this browser, with staleness recomputed. */
export const GET = withUser(async (_req, userId) => {
  const result = await latestSolo(userId);
  return ok({ result });
});
