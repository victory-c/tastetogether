import type { DemoResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';
import { loadDemo, resetDemo } from '@/server/services/demo';
import { demoSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const POST = withUser(async (req, userId) => {
  const { action } = await parseBody(req, demoSchema);
  if (action === 'reset') {
    await resetDemo(userId);
    return ok<DemoResponse>({ sessionId: null });
  }
  // Each load writes two sample profiles and a room; a handful per visitor is plenty.
  rateLimit(`demo:${userId}`, 10, 10 * 60_000);
  return ok<DemoResponse>({ sessionId: await loadDemo(userId) });
});
