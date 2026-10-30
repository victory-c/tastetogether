import 'server-only';
import type { Constraints, ParticipantView, RecommendationResult } from '@/domain/types';
import { factsFor, llmReasons } from '../llm/explain';
import { discover, QlooBudget, scoreCandidates } from '../qloo/client';
import { QlooError } from '../qloo/types';
import { getProfileById } from '../db/repos/profiles';
import { getRunByIdempotencyKey, insertRun, latestSoloRun } from '../db/repos/runs';
import * as sessionRepo from '../db/repos/sessions';
import { AppError } from '../http';
import { coordinate, ProviderUnavailableError, type QlooPort, type ReasonWriter } from './coordinator';
import { participantView } from './participants';
import { requireProfile } from './profiles';
import { accessSession, isRunStale } from './sessions';

// Normal round 4 calls + expansion round 4 calls, with headroom for one retry each.
const QLOO_CALLS_PER_RUN = 12;

function realQloo(budget: QlooBudget): QlooPort {
  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof QlooError) throw new ProviderUnavailableError(err.kind === 'budget_exhausted');
      throw err;
    }
  };
  return {
    discover: (req, purpose) => wrap(() => discover({ ...req, priceMax: req.priceMax as 1 | 2 | 3 | 4 | null }, budget, purpose)),
    score: (signals, ids, purpose) => wrap(() => scoreCandidates(signals, ids, budget, purpose)),
  };
}

const writeReasons: ReasonWriter = async (cards, participants, constraints, descriptions) =>
  llmReasons(
    factsFor(
      cards,
      participants.map((p) => ({ name: p.displayName, likes: p.positiveEntityNames.slice(0, 3) })),
      constraints.occasion,
      descriptions,
    ),
    cards.map((c) => c.name),
  );

async function execute(opts: {
  ownerId: string;
  sessionId: string | null;
  idempotencyKey: string;
  participants: ParticipantView[];
  constraints: Constraints;
  constraintVersion: number;
  rejected: string[];
}): Promise<RecommendationResult> {
  const prior = await getRunByIdempotencyKey(opts.ownerId, opts.idempotencyKey);
  if (prior) return prior.result;
  const budget = new QlooBudget(QLOO_CALLS_PER_RUN);
  const runId = crypto.randomUUID();
  const out = await coordinate({
    participants: opts.participants,
    constraints: opts.constraints,
    rejectedThisSession: opts.rejected,
    qloo: realQloo(budget),
    writeReasons,
    runId,
    now: new Date(),
  });
  await insertRun({
    id: runId,
    sessionId: opts.sessionId,
    ownerId: opts.ownerId,
    idempotencyKey: opts.idempotencyKey,
    profileVersions: Object.fromEntries(opts.participants.map((p) => [p.profileId, p.profileVersion])),
    constraintVersion: opts.constraintVersion,
    providerRefs: budget.refs,
    candidateIds: out.candidateIds,
    evidence: out.evidence,
    result: out.result,
  });
  return out.result;
}

export async function recommendSolo(
  userId: string,
  idempotencyKey: string,
  constraints: Constraints,
  rejected: string[] = [],
): Promise<RecommendationResult> {
  const profile = await requireProfile(userId);
  const view = await participantView(profile, 'A');
  return execute({ ownerId: userId, sessionId: null, idempotencyKey, participants: [view], constraints, constraintVersion: 0, rejected });
}

export async function latestSolo(userId: string): Promise<RecommendationResult | null> {
  const run = await latestSoloRun(userId);
  return run ? { ...run.result, stale: await isRunStale(run, null) } : null;
}

export async function recommendForSession(userId: string, sessionId: string, idempotencyKey: string): Promise<RecommendationResult> {
  const { session } = await accessSession(userId, sessionId);
  if (session.revoked || new Date(session.expiresAt).getTime() < Date.now()) throw new AppError('session_expired');
  if (!session.participantB) throw new AppError('conflict', 'Wait for your friend to join first.');
  if (!session.confirmedA || !session.confirmedB) throw new AppError('conflict', 'Both of you need to confirm the conditions first.');
  const [a, b] = await Promise.all([getProfileById(session.participantA), getProfileById(session.participantB)]);
  if (!a || !b) throw new AppError('not_found');
  const participants = await Promise.all([participantView(a, 'A'), participantView(b, 'B')]);
  await sessionRepo.setState(sessionId, 'querying');
  try {
    const result = await execute({
      ownerId: userId,
      sessionId,
      idempotencyKey,
      participants,
      constraints: session.constraints,
      constraintVersion: session.version,
      rejected: session.rejectedPlaceIds,
    });
    const next = {
      success: 'completed',
      no_match: 'needs_relaxation',
      needs_clarification: 'pending_confirmation',
      provider_unavailable: 'failed',
    } as const;
    await sessionRepo.setState(sessionId, next[result.status]);
    return result;
  } catch (err) {
    await sessionRepo.setState(sessionId, 'failed');
    throw err;
  }
}
