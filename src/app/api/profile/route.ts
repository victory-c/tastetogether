// Reference pattern for CRUD routes: withUser → parseBody(zod) → service → ok(). No SQL here.
import type { ProfileResponse } from '@/lib/api-types';
import { getProfileByOwner, toDTO } from '@/server/db/repos/profiles';
import { ok, parseBody, withUser } from '@/server/http';
import { upsertProfile } from '@/server/services/profiles';
import { profileInputSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const GET = withUser(async (_req, userId) => {
  const p = await getProfileByOwner(userId);
  return ok<ProfileResponse>({ profile: p ? toDTO(p) : null });
});

export const PUT = withUser(async (req, userId) => {
  const input = await parseBody(req, profileInputSchema);
  return ok<ProfileResponse>({ profile: toDTO(await upsertProfile(userId, input)) });
});
