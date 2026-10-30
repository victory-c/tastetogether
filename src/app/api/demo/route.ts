import type { DemoResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { loadDemo, resetDemo } from '@/server/services/demo';
import { demoSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const POST = withUser(async (req, userId) => {
  const { action } = await parseBody(req, demoSchema);
  if (action === 'reset') {
    await resetDemo(userId);
    return ok<DemoResponse>({ sessionId: null });
  }
  return ok<DemoResponse>({ sessionId: await loadDemo(userId) });
});
