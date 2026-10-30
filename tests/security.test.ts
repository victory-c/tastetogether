import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { __setClientForTests } from '@/server/db/client';
import { ensureUser } from '@/server/db/repos/users';
import { createProfile, getProfileById } from '@/server/db/repos/profiles';
import { getMemory, listMemories } from '@/server/db/repos/memories';
import { insertRun } from '@/server/db/repos/runs';
import { getSession } from '@/server/db/repos/sessions';
import { addMine, deleteMine, editMine } from '@/server/services/memories';
import {
  accessSession,
  confirmSession,
  createSession,
  isRunStale,
  joinSession,
  updateSessionConstraints,
} from '@/server/services/sessions';
import { recordFeedback } from '@/server/services/feedback';
import { coordinate, type QlooPort } from '@/server/services/coordinator';
import { candidate, constraints, participant } from './helpers';

const profileInput = {
  displayName: 'Person',
  area: { label: 'Area', lat: 37, lon: -122, radiusM: 1000 },
  priceMax: null,
  excludedCuisines: [],
  positiveEntities: [],
};
let profiles: Awaited<ReturnType<typeof createProfile>>[];
beforeEach(async () => {
  await __setClientForTests(createClient({ url: 'file::memory:' }));
  profiles = [];
  for (const user of ['x', 'y', 'z']) {
    await ensureUser(user);
    profiles.push(await createProfile(user, profileInput));
  }
});

async function room() {
  const session = await createSession('x', constraints(), 'https://example.test');
  const token = session.inviteUrl!.split('#')[1]!;
  return { session, token };
}

describe('ownership and session security', () => {
  it('scopes memory reads, edits and deletes to the owner', async () => {
    const memory = await addMine('y', { placeId: 'p', name: 'Place', address: null, status: 'visited' });
    expect(await getMemory(profiles[0]!.id, memory.id)).toBeNull();
    await expect(editMine('x', memory.id, { name: 'Changed' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(deleteMine('x', memory.id)).rejects.toMatchObject({ code: 'not_found' });
    expect((await listMemories(profiles[1]!.id))[0]?.name).toBe('Place');
  });
  it('rejects a wrong token and blocks a third user', async () => {
    const { session, token } = await room();
    await expect(joinSession('y', session.id, 'wrong')).rejects.toThrow();
    await joinSession('y', session.id, token);
    await expect(accessSession('z', session.id)).rejects.toMatchObject({ code: 'not_found' });
  });
  it('enforces versions and resets both confirmations when constraints change', async () => {
    const { session, token } = await room();
    const joined = await joinSession('y', session.id, token);
    await confirmSession('x', session.id, joined.version);
    await confirmSession('y', session.id, joined.version);
    await expect(updateSessionConstraints('x', session.id, constraints(), joined.version - 1)).rejects.toMatchObject({ code: 'conflict' });
    await updateSessionConstraints('x', session.id, constraints({ priceMax: 2 }), joined.version);
    const stored = await getSession(session.id);
    expect([stored?.confirmedA, stored?.confirmedB]).toEqual([false, false]);
  });
  it('writes visited feedback only for the caller and marks edited profiles stale', async () => {
    const { session, token } = await room();
    await joinSession('y', session.id, token);
    const stored = (await getSession(session.id))!;
    const qloo: QlooPort = {
      discover: async () => [{ candidate: candidate('p'), affinity: 1 }],
      score: async (_s, ids) => new Map(ids.map((id) => [id, 1])),
    };
    const { result } = await coordinate({
      participants: [participant('A')],
      constraints: constraints(),
      rejectedThisSession: [],
      qloo,
      runId: 'run',
      now: new Date(),
    });
    const versions = Object.fromEntries(profiles.slice(0, 2).map((p) => [p.id, p.version]));
    await insertRun({
      id: 'run',
      sessionId: session.id,
      ownerId: 'x',
      idempotencyKey: 'key',
      profileVersions: versions,
      constraintVersion: stored.version,
      providerRefs: [],
      candidateIds: ['p'],
      evidence: {},
      result,
    });
    await recordFeedback('x', { runId: 'run', placeId: 'p', kind: 'selected' });
    expect(await listMemories(profiles[0]!.id)).toEqual([]);
    await recordFeedback('y', { runId: 'run', placeId: 'p', kind: 'visited' });
    expect(await listMemories(profiles[0]!.id)).toEqual([]);
    expect((await listMemories(profiles[1]!.id))[0]).toMatchObject({ placeId: 'p', status: 'visited', source: 'feedback' });
    expect(await isRunStale({ profileVersions: versions, constraintVersion: stored.version }, stored)).toBe(true);
    const memory = (await listMemories(profiles[1]!.id))[0]!;
    const before = (await getProfileById(profiles[1]!.id))!.version;
    await editMine('y', memory.id, { name: 'Updated Place' });
    expect((await getProfileById(profiles[1]!.id))!.version).toBeGreaterThan(before);
    expect(await isRunStale({ profileVersions: { [profiles[1]!.id]: before }, constraintVersion: stored.version }, stored)).toBe(true);
  });
});
