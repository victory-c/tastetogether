import 'server-only';
import type { Constraints, ParticipantKey } from '@/domain/types';
import type { SessionDTO } from '@/lib/api-types';
import { getProfileById } from '../db/repos/profiles';
import { latestRunForSession } from '../db/repos/runs';
import * as repo from '../db/repos/sessions';
import { hashToken, newInviteToken } from '../auth/session';
import { AppError } from '../http';
import { requireProfile } from './profiles';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 3;

export interface SessionAccess {
  session: repo.SessionRecord;
  seat: ParticipantKey;
  isDemo: boolean;
}

/** Object-level access: only the two seated profiles' owners (or the demo's visitor) may see a room. */
export async function accessSession(userId: string, sessionId: string): Promise<SessionAccess> {
  const session = await repo.getSession(sessionId);
  if (!session) throw new AppError('not_found');
  const a = await getProfileById(session.participantA);
  const b = session.participantB ? await getProfileById(session.participantB) : null;
  const isDemo = Boolean(a?.isDemo);
  let seat: ParticipantKey | null = null;
  if (a?.ownerId === userId) seat = 'A';
  else if (b?.ownerId === userId) seat = 'B';
  else if (isDemo && session.ownerId === userId) seat = 'A';
  // Same response as missing so room ids can't be probed.
  if (!seat) throw new AppError('not_found');
  return { session, seat, isDemo };
}

function assertLive(s: repo.SessionRecord): void {
  if (s.revoked || new Date(s.expiresAt).getTime() < Date.now()) throw new AppError('session_expired');
}

function inviteUrl(origin: string, sessionId: string, token: string): string {
  return `${origin}/join/${sessionId}#${token}`;
}

export async function createSession(userId: string, constraints: Constraints, origin: string): Promise<SessionDTO> {
  const profile = await requireProfile(userId);
  if (profile.isDemo) throw new AppError('forbidden');
  const { token, hash } = newInviteToken();
  const s = await repo.insertSession({
    ownerId: userId,
    participantA: profile.id,
    inviteTokenHash: hash,
    constraints,
    state: 'waiting_for_partner',
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  return { ...(await toDTO(userId, { session: s, seat: 'A', isDemo: false })), inviteUrl: inviteUrl(origin, s.id, token) };
}

export async function rotateInvite(userId: string, sessionId: string, origin: string): Promise<SessionDTO> {
  const access = await accessSession(userId, sessionId);
  assertLive(access.session);
  if (access.seat !== 'A' || access.isDemo) throw new AppError('forbidden');
  const { token, hash } = newInviteToken();
  if (!(await repo.rotateInvite(sessionId, userId, hash))) throw new AppError('conflict');
  return { ...(await getSessionDTO(userId, sessionId)), inviteUrl: inviteUrl(origin, sessionId, token) };
}

/** Joining grants this room's coordinator use of the joiner's profile — nothing more. */
export async function joinSession(userId: string, sessionId: string, token: string): Promise<SessionDTO> {
  const s = await repo.getSession(sessionId);
  if (!s) throw new AppError('not_found');
  const profile = await requireProfile(userId);
  if (profile.id === s.participantA || profile.id === s.participantB) return getSessionDTO(userId, sessionId);
  assertLive(s);
  if (profile.isDemo) throw new AppError('forbidden');
  if (!(await repo.claimSeatB(sessionId, hashToken(token), profile.id))) {
    // Wrong token, already full, or revoked: indistinguishable to the caller.
    throw new AppError('session_expired');
  }
  return getSessionDTO(userId, sessionId);
}

export async function updateSessionConstraints(
  userId: string,
  sessionId: string,
  constraints: Constraints,
  expectedVersion: number,
): Promise<SessionDTO> {
  const { session } = await accessSession(userId, sessionId);
  assertLive(session);
  const next = session.participantB ? 'pending_confirmation' : 'waiting_for_partner';
  if (!(await repo.updateConstraints(sessionId, expectedVersion, constraints, next))) throw new AppError('conflict');
  return getSessionDTO(userId, sessionId);
}

export async function confirmSession(userId: string, sessionId: string, expectedVersion: number): Promise<SessionDTO> {
  const { session, seat, isDemo } = await accessSession(userId, sessionId);
  assertLive(session);
  if (!session.participantB) throw new AppError('conflict', 'Wait for your friend to join first.');
  const seats: ParticipantKey[] = isDemo ? ['A', 'B'] : [seat];
  for (const s of seats) if (!(await repo.setConfirmed(sessionId, s, expectedVersion))) throw new AppError('conflict');
  return getSessionDTO(userId, sessionId);
}

export async function rejectPlace(userId: string, sessionId: string, placeId: string): Promise<SessionDTO> {
  const { session } = await accessSession(userId, sessionId);
  assertLive(session);
  await repo.addRejected(sessionId, placeId);
  return getSessionDTO(userId, sessionId);
}

export async function getSessionDTO(userId: string, sessionId: string): Promise<SessionDTO> {
  return toDTO(userId, await accessSession(userId, sessionId));
}

/** A run is stale once the room's constraints or either profile changed after it ran. */
export async function isRunStale(
  run: { constraintVersion: number; profileVersions: Record<string, number> },
  session: repo.SessionRecord | null,
): Promise<boolean> {
  if (session && run.constraintVersion !== session.version) return true;
  for (const [profileId, version] of Object.entries(run.profileVersions)) {
    const p = await getProfileById(profileId);
    if (!p || p.version !== version) return true;
  }
  return false;
}

async function toDTO(userId: string, { session, seat, isDemo }: SessionAccess): Promise<SessionDTO> {
  const a = await getProfileById(session.participantA);
  const b = session.participantB ? await getProfileById(session.participantB) : null;
  const run = await latestRunForSession(session.id);
  const latestResult = run ? { ...run.result, stale: await isRunStale(run, session) } : null;
  return {
    id: session.id,
    state: session.state,
    you: seat,
    isDemo,
    participants: [
      { key: 'A', displayName: a?.displayName ?? 'Host', joined: true, confirmed: session.confirmedA, isYou: seat === 'A' },
      {
        key: 'B',
        displayName: b?.displayName ?? 'Your friend',
        joined: Boolean(b),
        confirmed: session.confirmedB,
        isYou: seat === 'B' && !isDemo,
      },
    ],
    constraints: session.constraints,
    version: session.version,
    expiresAt: session.expiresAt,
    inviteUrl: null,
    rejectedCount: session.rejectedPlaceIds.length,
    latestResult,
  };
}
