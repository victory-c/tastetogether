import 'server-only';
import type { ParticipantKey, ParticipantView } from '@/domain/types';
import { listMemories } from '../db/repos/memories';
import type { ProfileRecord } from '../db/repos/profiles';

const MAX_SIGNALS = 12;

/**
 * The authorized view a personal agent hands to the coordinator: signals, limits and
 * place-id sets only. Raw history (dates, ratings, notes) never leaves this function.
 */
export async function participantView(profile: ProfileRecord, key: ParticipantKey): Promise<ParticipantView> {
  const memories = await listMemories(profile.id);
  const liked = memories.filter((m) => m.status === 'visited' && m.rating === 'liked' && m.placeId);
  const signals = new Map<string, string>();
  for (const e of profile.positiveEntities) signals.set(e.id, e.name);
  for (const m of liked) if (!signals.has(m.placeId!)) signals.set(m.placeId!, m.name);
  const ids = [...signals.keys()].slice(0, MAX_SIGNALS);
  return {
    key,
    profileId: profile.id,
    profileVersion: profile.version,
    displayName: profile.displayName,
    positiveEntityIds: ids,
    positiveEntityNames: ids.map((id) => signals.get(id)!),
    excludedCuisines: profile.excludedCuisines,
    priceMax: profile.priceMax,
    visitedPlaceIds: memories.filter((m) => m.status === 'visited' && m.placeId).map((m) => m.placeId!),
    dismissedPlaceIds: memories.filter((m) => m.status === 'dismissed' && m.placeId).map((m) => m.placeId!),
    hasUnresolvedHistory: memories.some((m) => m.placeId === null && m.status !== 'want_to_try'),
  };
}
