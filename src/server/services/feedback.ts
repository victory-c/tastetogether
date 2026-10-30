import 'server-only';
import type { FeedbackInput } from '@/lib/api-types';
import { createMemory, findMemoryByPlace, updateMemory } from '../db/repos/memories';
import { getProfileById, getProfileByOwner } from '../db/repos/profiles';
import { getRun, insertFeedback } from '../db/repos/runs';
import * as sessionRepo from '../db/repos/sessions';
import { AppError } from '../http';
import { accessSession } from './sessions';

/**
 * Only an explicit "I went" writes a visited memory, and only into the caller's own profile.
 * Seeing, selecting or skipping a recommendation never counts as a visit.
 */
export async function recordFeedback(userId: string, input: FeedbackInput): Promise<void> {
  const run = await getRun(input.runId);
  if (!run) throw new AppError('not_found');

  let profileId: string;
  if (run.sessionId) {
    const { session, seat, isDemo } = await accessSession(userId, run.sessionId);
    const pid = seat === 'A' ? session.participantA : session.participantB;
    if (!pid) throw new AppError('forbidden');
    const p = await getProfileById(pid);
    if (!p || (p.ownerId !== userId && !(isDemo && session.ownerId === userId))) throw new AppError('forbidden');
    profileId = p.id;
    if (input.kind === 'selected') await sessionRepo.setState(session.id, 'completed');
  } else {
    if (run.ownerId !== userId) throw new AppError('not_found');
    const p = await getProfileByOwner(userId);
    if (!p) throw new AppError('profile_required');
    profileId = p.id;
  }

  const card = run.result.cards.find((c) => c.placeId === input.placeId);
  if (!card) throw new AppError('invalid_input');

  await insertFeedback({
    runId: run.id,
    profileId,
    placeId: input.placeId,
    kind: input.kind,
    rating: input.rating,
    revisitIntent: input.revisitIntent,
  });
  if (input.kind !== 'visited') return;

  const existing = await findMemoryByPlace(profileId, input.placeId);
  const fields = {
    status: 'visited' as const,
    rating: input.rating ?? null,
    revisitIntent: input.revisitIntent ?? null,
    visitDate: new Date().toISOString().slice(0, 10),
  };
  if (existing) await updateMemory(profileId, existing.id, { ...fields, visitCount: (existing.visitCount ?? 0) + 1 });
  else
    await createMemory(profileId, { placeId: card.placeId, name: card.name, address: card.address, visitCount: 1, ...fields }, 'feedback');
}
