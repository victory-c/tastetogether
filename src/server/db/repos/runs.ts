import 'server-only';
import type { RecommendationResult, RunStatus } from '@/domain/types';
import { one, now, parseJson, run } from '../client';

export interface RunRecord {
  id: string;
  sessionId: string | null;
  ownerId: string;
  profileVersions: Record<string, number>;
  constraintVersion: number;
  candidateIds: string[];
  result: RecommendationResult;
  status: RunStatus;
  createdAt: string;
}

interface RunRow {
  id: string;
  session_id: string | null;
  owner_id: string;
  profile_versions: string;
  constraint_version: number;
  candidate_ids: string;
  result: string;
  status: RunStatus;
  created_at: string;
}

/** Runs stored before a field existed must still render: fill fields added later with safe defaults. */
function normalizeResult(result: RecommendationResult): RecommendationResult {
  if (!result) return result;
  return {
    ...result,
    perParticipant: result.perParticipant ?? [],
    cards: (result.cards ?? []).map((c) => ({
      ...c,
      ranks: c.ranks ?? {},
      occasionTags: c.occasionTags ?? [],
      imageUrl: c.imageUrl ?? null,
    })),
  };
}

function toRecord(r: RunRow): RunRecord {
  return {
    id: r.id,
    sessionId: r.session_id,
    ownerId: r.owner_id,
    profileVersions: parseJson(r.profile_versions, {}),
    constraintVersion: Number(r.constraint_version),
    candidateIds: parseJson(r.candidate_ids, []),
    result: normalizeResult(parseJson(r.result, null as unknown as RecommendationResult)),
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function insertRun(r: {
  id: string;
  sessionId: string | null;
  ownerId: string;
  idempotencyKey: string;
  profileVersions: Record<string, number>;
  constraintVersion: number;
  providerRefs: unknown;
  candidateIds: string[];
  evidence: unknown;
  result: RecommendationResult;
}): Promise<void> {
  await run(
    `INSERT INTO recommendation_runs (id, session_id, owner_id, idempotency_key, profile_versions, constraint_version, provider_refs, candidate_ids, evidence, result, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id,
      r.sessionId,
      r.ownerId,
      r.idempotencyKey,
      JSON.stringify(r.profileVersions),
      r.constraintVersion,
      JSON.stringify(r.providerRefs),
      JSON.stringify(r.candidateIds),
      JSON.stringify(r.evidence),
      JSON.stringify(r.result),
      r.result.status,
      r.result.createdAt,
    ],
  );
}

export async function getRunByIdempotencyKey(ownerId: string, key: string): Promise<RunRecord | null> {
  const r = await one<RunRow>('SELECT * FROM recommendation_runs WHERE idempotency_key = ? AND owner_id = ?', [key, ownerId]);
  return r ? toRecord(r) : null;
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const r = await one<RunRow>('SELECT * FROM recommendation_runs WHERE id = ?', [id]);
  return r ? toRecord(r) : null;
}

export async function latestRunForSession(sessionId: string): Promise<RunRecord | null> {
  const r = await one<RunRow>('SELECT * FROM recommendation_runs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1', [sessionId]);
  return r ? toRecord(r) : null;
}

export async function latestSoloRun(ownerId: string): Promise<RunRecord | null> {
  const r = await one<RunRow>(
    'SELECT * FROM recommendation_runs WHERE owner_id = ? AND session_id IS NULL ORDER BY created_at DESC LIMIT 1',
    [ownerId],
  );
  return r ? toRecord(r) : null;
}

export async function insertFeedback(f: {
  runId: string;
  profileId: string;
  placeId: string;
  kind: 'selected' | 'dismissed' | 'visited';
  rating?: string | null;
  revisitIntent?: boolean | null;
  reason?: string | null;
}): Promise<void> {
  await run(
    'INSERT INTO feedback (id, run_id, profile_id, place_id, kind, rating, revisit_intent, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      crypto.randomUUID(),
      f.runId,
      f.profileId,
      f.placeId,
      f.kind,
      f.rating ?? null,
      f.revisitIntent === undefined || f.revisitIntent === null ? null : f.revisitIntent ? 1 : 0,
      f.reason ?? null,
      now(),
    ],
  );
}

export async function hasFeedback(
  runId: string,
  profileId: string,
  placeId: string,
  kind: 'selected' | 'dismissed' | 'visited',
): Promise<boolean> {
  return (
    (await one('SELECT 1 FROM feedback WHERE run_id = ? AND profile_id = ? AND place_id = ? AND kind = ? LIMIT 1', [
      runId,
      profileId,
      placeId,
      kind,
    ])) !== null
  );
}
