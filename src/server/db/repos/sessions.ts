import 'server-only';
import type { Constraints, SessionState } from '@/domain/types';
import { newId, now, one, parseJson, run } from '../client';

interface SessionRow {
  id: string;
  owner_id: string;
  invite_token_hash: string;
  participant_a: string;
  participant_b: string | null;
  consent_b: number;
  confirmed_a: number;
  confirmed_b: number;
  constraints: string;
  rejected_place_ids: string;
  state: SessionState;
  version: number;
  revoked: number;
  expires_at: string;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  ownerId: string;
  inviteTokenHash: string;
  participantA: string;
  participantB: string | null;
  consentB: boolean;
  confirmedA: boolean;
  confirmedB: boolean;
  constraints: Constraints;
  rejectedPlaceIds: string[];
  state: SessionState;
  version: number;
  revoked: boolean;
  expiresAt: string;
}

function toRecord(r: SessionRow): SessionRecord {
  return {
    id: r.id,
    ownerId: r.owner_id,
    inviteTokenHash: r.invite_token_hash,
    participantA: r.participant_a,
    participantB: r.participant_b,
    consentB: r.consent_b === 1,
    confirmedA: r.confirmed_a === 1,
    confirmedB: r.confirmed_b === 1,
    constraints: parseJson<Constraints>(r.constraints, null as unknown as Constraints),
    rejectedPlaceIds: parseJson<string[]>(r.rejected_place_ids, []),
    state: r.state,
    version: Number(r.version),
    revoked: r.revoked === 1,
    expiresAt: r.expires_at,
  };
}

export async function insertSession(s: { ownerId: string; participantA: string; participantB?: string | null; consentB?: boolean; inviteTokenHash: string; constraints: Constraints; state: SessionState; expiresAt: string }): Promise<SessionRecord> {
  const id = newId();
  await run(
    `INSERT INTO match_sessions (id, owner_id, invite_token_hash, participant_a, participant_b, consent_b, constraints, state, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, s.ownerId, s.inviteTokenHash, s.participantA, s.participantB ?? null, s.consentB ? 1 : 0, JSON.stringify(s.constraints), s.state, s.expiresAt, now()],
  );
  return (await getSession(id))!;
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const r = await one<SessionRow>('SELECT * FROM match_sessions WHERE id = ?', [id]);
  return r ? toRecord(r) : null;
}

/** Atomic seat claim: only succeeds if seat B is empty and the token hash matches. */
export async function claimSeatB(id: string, tokenHash: string, profileId: string): Promise<boolean> {
  const n = await run(
    `UPDATE match_sessions SET participant_b = ?, consent_b = 1, confirmed_a = 0, confirmed_b = 0, state = 'pending_confirmation', version = version + 1
     WHERE id = ? AND invite_token_hash = ? AND participant_b IS NULL AND revoked = 0 AND participant_a != ?`,
    [profileId, id, tokenHash, profileId],
  );
  return n > 0;
}

/** Optimistic concurrency on version. Any constraint change resets both confirmations. */
export async function updateConstraints(id: string, expectedVersion: number, constraints: Constraints, state: SessionState): Promise<boolean> {
  const n = await run(
    `UPDATE match_sessions SET constraints = ?, version = version + 1, confirmed_a = 0, confirmed_b = 0, state = ? WHERE id = ? AND version = ?`,
    [JSON.stringify(constraints), state, id, expectedVersion],
  );
  return n > 0;
}

export async function setConfirmed(id: string, seat: 'A' | 'B', expectedVersion: number): Promise<boolean> {
  const col = seat === 'A' ? 'confirmed_a' : 'confirmed_b';
  const n = await run(`UPDATE match_sessions SET ${col} = 1 WHERE id = ? AND version = ?`, [id, expectedVersion]);
  return n > 0;
}

export async function setState(id: string, state: SessionState): Promise<void> {
  await run('UPDATE match_sessions SET state = ? WHERE id = ?', [state, id]);
}

export async function addRejected(id: string, placeId: string): Promise<void> {
  const s = await getSession(id);
  if (!s || s.rejectedPlaceIds.includes(placeId)) return;
  await run('UPDATE match_sessions SET rejected_place_ids = ? WHERE id = ?', [JSON.stringify([...s.rejectedPlaceIds, placeId]), id]);
}

export async function rotateInvite(id: string, ownerId: string, tokenHash: string): Promise<boolean> {
  const n = await run('UPDATE match_sessions SET invite_token_hash = ? WHERE id = ? AND owner_id = ? AND participant_b IS NULL', [tokenHash, id, ownerId]);
  return n > 0;
}

export async function revokeSession(id: string, ownerId: string): Promise<boolean> {
  const n = await run('UPDATE match_sessions SET revoked = 1 WHERE id = ? AND owner_id = ?', [id, ownerId]);
  return n > 0;
}
