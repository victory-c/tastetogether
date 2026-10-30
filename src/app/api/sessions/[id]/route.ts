import type { SessionResponse } from '@/lib/api-types';
import { ok, withUser } from '@/server/http';
import { getSessionDTO } from '@/server/services/sessions';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = withUser<Ctx>(async (_req, userId, { params }) => {
  const { id } = await params;
  return ok<SessionResponse>({ session: await getSessionDTO(userId, id) });
});
