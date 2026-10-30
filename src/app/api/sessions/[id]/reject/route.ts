import type { SessionResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { rejectPlace } from '@/server/services/sessions';
import { rejectSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>(async (req, userId, { params }) => {
  const { id } = await params;
  const body = await parseBody(req, rejectSchema);
  return ok<SessionResponse>({ session: await rejectPlace(userId, id, body.placeId) });
});
