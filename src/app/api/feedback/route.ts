import type { FeedbackResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { recordFeedback } from '@/server/services/feedback';
import { feedbackSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const POST = withUser(async (req, userId) => {
  await recordFeedback(userId, await parseBody(req, feedbackSchema));
  return ok<FeedbackResponse>({ ok: true });
});
