import 'server-only';
import { all, run } from '../db/client';
import { createMemory } from '../db/repos/memories';
import { createProfile } from '../db/repos/profiles';
import * as sessionRepo from '../db/repos/sessions';
import { ensureUser } from '../db/repos/users';
import { newInviteToken } from '../auth/session';
import { DEMO_CONSTRAINTS, DEMO_PEOPLE } from './demo-data';

/**
 * Each visitor gets private copies of two fictional sample profiles, owned by throwaway users,
 * plus a room the visitor drives. Sample data never touches real users' profiles.
 */
export async function loadDemo(visitorId: string): Promise<string> {
  await resetDemo(visitorId);
  const profileIds: string[] = [];
  for (const person of DEMO_PEOPLE) {
    const ownerId = `demo-${crypto.randomUUID()}`;
    await ensureUser(ownerId);
    const profile = await createProfile(ownerId, person.profile, true);
    for (const m of person.memories) await createMemory(profile.id, m, 'demo');
    profileIds.push(profile.id);
  }
  const s = await sessionRepo.insertSession({
    ownerId: visitorId,
    participantA: profileIds[0]!,
    participantB: profileIds[1]!,
    consentB: true,
    inviteTokenHash: newInviteToken().hash,
    constraints: DEMO_CONSTRAINTS,
    state: 'pending_confirmation',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  });
  // Both sample people "agree" up front so the one-minute demo can generate immediately.
  await sessionRepo.setConfirmed(s.id, 'A', s.version);
  await sessionRepo.setConfirmed(s.id, 'B', s.version);
  return s.id;
}

export async function resetDemo(visitorId: string): Promise<void> {
  const sessions = await all<{ id: string; participant_a: string; participant_b: string | null }>(
    `SELECT s.id, s.participant_a, s.participant_b FROM match_sessions s JOIN profiles p ON p.id = s.participant_a
     WHERE s.owner_id = ? AND p.is_demo = 1`,
    [visitorId],
  );
  for (const s of sessions) {
    const profiles = [s.participant_a, s.participant_b].filter((p): p is string => Boolean(p));
    await run('DELETE FROM feedback WHERE run_id IN (SELECT id FROM recommendation_runs WHERE session_id = ?)', [s.id]);
    await run('DELETE FROM recommendation_runs WHERE session_id = ?', [s.id]);
    await run('DELETE FROM match_sessions WHERE id = ?', [s.id]);
    for (const pid of profiles) {
      const owner = await all<{ owner_id: string }>('SELECT owner_id FROM profiles WHERE id = ? AND is_demo = 1', [pid]);
      await run('DELETE FROM memories WHERE profile_id = ?', [pid]);
      await run('DELETE FROM feedback WHERE profile_id = ?', [pid]);
      await run('DELETE FROM profiles WHERE id = ? AND is_demo = 1', [pid]);
      if (owner[0]) await run("DELETE FROM users WHERE id = ? AND id LIKE 'demo-%'", [owner[0].owner_id]);
    }
  }
}
