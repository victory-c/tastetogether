import type { SessionResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { createSession } from '@/server/services/sessions';
import { createSessionSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const POST = withUser(async (req, userId) => {
  const { constraints } = await parseBody(req, createSessionSchema);
  return ok<SessionResponse>({ session: await createSession(userId, constraints, new URL(req.url).origin) }, 201);
});
