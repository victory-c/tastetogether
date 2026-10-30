import type { SessionResponse } from '@/lib/api-types';
import { ok, withUser } from '@/server/http';
import { rotateInvite } from '@/server/services/sessions';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Issues a fresh invite link (the old one stops working). Host only, before anyone has joined. */
export const POST = withUser<Ctx>(async (req, userId, { params }) => {
  const { id } = await params;
  return ok<SessionResponse>({ session: await rotateInvite(userId, id, new URL(req.url).origin) });
});
