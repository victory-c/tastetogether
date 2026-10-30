import type { PlaceSearchResponse } from '@/lib/api-types';
import { getProfileByOwner } from '@/server/db/repos/profiles';
import { AppError, ok, withUser } from '@/server/http';
import { QlooBudget, searchPlaces } from '@/server/qloo/client';
import { QlooError } from '@/server/qloo/types';
import { BERKELEY } from '@/server/services/demo-data';

export const dynamic = 'force-dynamic';

export const GET = withUser(async (req, userId) => {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2 || q.length > 80) throw new AppError('invalid_input');

  const area = (await getProfileByOwner(userId))?.area ?? BERKELEY;
  try {
    const places = await searchPlaces(q, new QlooBudget(2), { lat: area.lat, lon: area.lon });
    return ok<PlaceSearchResponse>({
      results: places.slice(0, 8).map(({ placeId, name, address }) => ({ placeId, name, address })),
    });
  } catch (err) {
    if (err instanceof QlooError) {
      throw new AppError(err.kind === 'budget_exhausted' ? 'rate_limited' : 'provider_unavailable');
    }
    throw err;
  }
});
