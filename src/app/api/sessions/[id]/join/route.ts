import type { SessionResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { joinSession } from '@/server/services/sessions';
import { joinSessionSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>(async (req, userId, { params }) => {
  const { id } = await params;
  const body = await parseBody(req, joinSessionSchema);
  return ok<SessionResponse>({ session: await joinSession(userId, id, body.token) });
});
