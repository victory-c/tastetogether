// Coordinator: request validation → per-participant Qloo discovery → merge → hard filter →
// per-participant scoring → fair ranking → decision mode → explanations → validated result.
// No persistence here, and Qloo is injected, so every branch is testable with fixtures.

import { copy } from '@/copy/en';
import { cuisineNames } from '@/domain/cuisines';
import { selectForMode, suggestRelaxations, summarizeExclusions, wantedCount } from '@/domain/decision';
import { applyHardFilters, effectivePriceMax, effectiveRadiusM } from '@/domain/filters';
import { reasonsAreSafe } from '@/domain/validate';
import { hoursTextFor, weekdayOf } from '@/domain/hours';
import { rankCandidates, type AffinityTable } from '@/domain/ranking';
import {
  WEEKDAYS,
  type Candidate,
  type Constraints,
  type Exclusion,
  type ParticipantKey,
  type ParticipantView,
  type RecommendationCard,
  type RecommendationResult,
  type ScoredCandidate,
} from '@/domain/types';
import { templateReasons } from '../llm/templates';

export interface DiscoverRequest {
  signalEntityIds: string[];
  center: { lat: number; lon: number };
  radiusM: number;
  priceMax: number | null;
  take: number;
}

/** The two Qloo capabilities the coordinator needs. Real client in production, fixtures in tests. */
export interface QlooPort {
  discover(req: DiscoverRequest, purpose: string): Promise<{ candidate: Candidate; affinity: number | null }[]>;
  score(signalEntityIds: string[], placeIds: string[], purpose: string): Promise<Map<string, number>>;
}

/** Thrown by a QlooPort to signal the provider is down, timed out, or out of budget. */
export class ProviderUnavailableError extends Error {
  constructor(readonly rateLimited = false) {
    super('provider_unavailable');
  }
}

export type ReasonWriter = (
  cards: RecommendationCard[],
  participants: ParticipantView[],
  constraints: Constraints,
  descriptions: Map<string, string | null>,
) => Promise<Map<string, string[]> | null>;

export interface CoordinatorInput {
  participants: ParticipantView[];
  constraints: Constraints;
  rejectedThisSession: string[];
  qloo: QlooPort;
  /** Optional LLM rewrite; validated output only. */
  writeReasons?: ReasonWriter;
  runId: string;
  now: Date;
}

export interface CoordinatorOutput {
  result: RecommendationResult;
  candidateIds: string[];
  evidence: {
    excluded: Exclusion[];
    ranked: { placeId: string; scores: ScoredCandidate['scores']; minUtility: number; meanUtility: number }[];
  };
}

/** 2 discovery + 2 scoring calls normally, plus one bounded expansion round. */
const SCORE_POOL = 50;

export async function coordinate(input: CoordinatorInput): Promise<CoordinatorOutput> {
  const { participants, constraints, rejectedThisSession, qloo } = input;
  const keys = participants.map((p) => p.key);
  const base = emptyResult(input);

  // 1. Missing constraints → ask, don't guess.
  const missing: string[] = [];
  if (!constraints.area) missing.push(copy.conditions.area);
  for (const p of participants) if (p.positiveEntityIds.length === 0) missing.push(copy.conditions.signals(p.displayName));
  if (missing.length) {
    return {
      result: { ...base, status: 'needs_clarification', conditionsToConfirm: missing, message: copy.status.needs_clarification },
      candidateIds: [],
      evidence: { excluded: [], ranked: [] },
    };
  }
  const area = constraints.area!;
  const priceMax = effectivePriceMax(constraints, participants);
  const radiusM = effectiveRadiusM(constraints)!;
  const want = wantedCount(constraints.decisionMode);
  const solo = participants.length === 1;

  let pool: Candidate[] = [];
  let discoveryAffinity = new Map<string, number>();
  let filtered = { kept: [] as Candidate[], excluded: [] as Exclusion[] };
  let ranked: ScoredCandidate[] = [];
  let missingScores: Exclusion[] = [];
  let selection: ReturnType<typeof selectForMode> = { selected: [], heldForUnverifiedHours: 0 };

  try {
    // One normal round; if it can't fill the decision mode, one bounded expansion with a larger take.
    // Hard constraints are identical in both rounds.
    for (const take of solo ? [40, 50] : [25, 50]) {
      const lists = await Promise.all(
        participants.map((p) =>
          qloo.discover({ signalEntityIds: p.positiveEntityIds, center: area.center, radiusM, priceMax, take }, `discover_${p.key}`),
        ),
      );
      ({ pool, discoveryAffinity } = mergeCandidates(lists, solo));
      filtered = applyHardFilters({ candidates: pool, participants, constraints, rejectedThisSession });

      const affinities: AffinityTable = {};
      if (solo) {
        // Solo: discovery affinities all come from one query, so they are already comparable.
        affinities.A = new Map(
          filtered.kept.flatMap((c) => (discoveryAffinity.has(c.placeId) ? [[c.placeId, discoveryAffinity.get(c.placeId)!] as const] : [])),
        );
      } else {
        // Two people: score the same filtered pool against each person's own signals, one query each.
        const scorePool = interleaveCap(filtered.kept, SCORE_POOL);
        const ids = scorePool.map((c) => c.placeId);
        const scored = await Promise.all(participants.map((p) => qloo.score(p.positiveEntityIds, ids, `score_${p.key}`)));
        participants.forEach((p, i) => (affinities[p.key] = scored[i]!));
        filtered = { ...filtered, kept: scorePool };
      }
      ({ ranked, missingScores } = rankCandidates(filtered.kept, keys, affinities, constraints));
      selection = selectForMode(ranked, constraints);
      if (selection.selected.length >= want) break;
    }
  } catch (err) {
    if (err instanceof ProviderUnavailableError) {
      return {
        result: {
          ...base,
          status: 'provider_unavailable',
          message: err.rateLimited ? copy.errors.rate_limited : copy.status.provider_unavailable,
        },
        candidateIds: [],
        evidence: { excluded: [], ranked: [] },
      };
    }
    throw err;
  }

  const excluded = [...filtered.excluded, ...missingScores];
  const evidence = {
    excluded,
    ranked: ranked.map((r) => ({ placeId: r.candidate.placeId, scores: r.scores, minUtility: r.minUtility, meanUtility: r.meanUtility })),
  };
  const candidateIds = pool.map((c) => c.placeId);
  // Surfaced through result.historyIncomplete (the UI shows one warning), not duplicated in unknowns.
  const historyIncomplete = noveltyApplied(constraints) && participants.some((p) => p.hasUnresolvedHistory);
  const exclusionSummary = summarizeExclusions(excluded);

  const unknowns: string[] = [];
  if (constraints.budgetNote) unknowns.push(copy.unknowns.budgetNote(constraints.budgetNote));
  const budgetToConfirm = constraints.budgetNote ? [copy.conditions.budget(constraints.budgetNote)] : [];
  if (missingScores.length) unknowns.push(copy.unknowns.partialScores(missingScores.length));

  // 2. Nothing selectable.
  if (selection.selected.length === 0) {
    if (selection.heldForUnverifiedHours > 0) {
      return {
        result: {
          ...base,
          status: 'needs_clarification',
          unknowns,
          historyIncomplete,
          exclusionSummary,
          conditionsToConfirm: [copy.conditions.hoursRequired(selection.heldForUnverifiedHours)],
          message: copy.status.needs_clarification,
        },
        candidateIds,
        evidence,
      };
    }
    return {
      result: {
        ...base,
        status: 'no_match',
        unknowns,
        historyIncomplete,
        exclusionSummary,
        relaxationOptions: suggestRelaxations(excluded, constraints),
        message: copy.status.no_match,
      },
      candidateIds,
      evidence,
    };
  }

  // 3. Cards with template reasons, then optional validated LLM rewrite.
  let cards = selection.selected.map((s) => toCard(s, participants, constraints, priceMax));
  const descriptions = new Map(selection.selected.map((s) => [s.candidate.placeId, s.candidate.description]));
  let explanationSource: RecommendationResult['explanationSource'] = 'template';
  if (input.writeReasons) {
    const rewritten = await input.writeReasons(cards, participants, constraints, descriptions).catch(() => null);
    // Validate here too: a writer is untrusted, and partial or unsafe output falls back to templates.
    const names = cards.map((c) => c.name);
    const safe =
      rewritten &&
      cards.every((c) => {
        const reasons = rewritten.get(c.placeId);
        return reasons !== undefined && reasonsAreSafe({ reasons, allowedNames: [c.name], forbiddenNames: names });
      });
    if (rewritten && safe) {
      cards = cards.map((c) => ({ ...c, reasons: rewritten.get(c.placeId) ?? c.reasons }));
      explanationSource = 'llm';
    }
  }

  const priceUnknown = cards.filter((c) => c.priceLevel === null).length;
  const hoursUnknown = cards.filter((c) => c.hoursStatus === 'unverified').length;
  if (priceUnknown) unknowns.push(copy.unknowns.price(priceUnknown));
  if (hoursUnknown) unknowns.push(copy.unknowns.hours(hoursUnknown));

  const short = constraints.decisionMode === 'three' && cards.length < want;
  return {
    result: {
      ...base,
      status: 'success',
      perParticipant: soloTopPicks(eligibleForSelection(ranked, constraints), participants),
      conditionsToConfirm: budgetToConfirm,
      cards,
      unknowns,
      historyIncomplete,
      exclusionSummary,
      explanationSource,
      relaxationOptions: short ? suggestRelaxations(excluded, constraints) : [],
      message: short ? copy.status.fewerThanThree(cards.length) : null,
    },
    candidateIds,
    evidence,
  };
}

/** The same pool selectForMode picks from: with "must be open", unverified-hours places are held back. */
function eligibleForSelection(ranked: ScoredCandidate[], constraints: Constraints): ScoredCandidate[] {
  return constraints.requireOpen && constraints.timeWindow ? ranked.filter((r) => r.hoursStatus === 'open_at_start') : ranked;
}

/**
 * Each person's own top three over the same filtered, jointly scored pool. Two-person runs only.
 * These are restaurant names and ranks, never the other person's history.
 */
function soloTopPicks(ranked: ScoredCandidate[], participants: ParticipantView[]): RecommendationResult['perParticipant'] {
  if (participants.length < 2) return [];
  return participants.map((p) => ({
    key: p.key,
    displayName: p.displayName,
    picks: [...ranked]
      .sort((x, y) => x.scores[p.key]!.rank - y.scores[p.key]!.rank)
      .slice(0, 3)
      .map((r) => ({ placeId: r.candidate.placeId, name: r.candidate.name, rank: r.scores[p.key]!.rank + 1 })),
  }));
}

/** Whether visited places were actually excluded for this run (the allow_revisits relaxation turns it off). */
function noveltyApplied(constraints: Constraints): boolean {
  return constraints.excludeVisited && !constraints.relaxations.includes('allow_revisits');
}

function emptyResult(input: CoordinatorInput): RecommendationResult {
  return {
    status: 'success',
    runId: input.runId,
    decisionMode: input.constraints.decisionMode,
    cards: [],
    unknowns: [],
    conditionsToConfirm: [],
    relaxationOptions: [],
    exclusionSummary: [],
    historyIncomplete: false,
    dataSources: [copy.sources.qloo, copy.sources.user],
    explanationSource: 'template',
    message: null,
    createdAt: input.now.toISOString(),
    perParticipant: [],
    stale: false,
  };
}

/** Union by entity id, interleaving lists so neither participant dominates the head of the pool. */
function mergeCandidates(
  lists: { candidate: Candidate; affinity: number | null }[][],
  solo: boolean,
): { pool: Candidate[]; discoveryAffinity: Map<string, number> } {
  const pool: Candidate[] = [];
  const seen = new Set<string>();
  const discoveryAffinity = new Map<string, number>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const row = list[i];
      if (!row || seen.has(row.candidate.placeId)) continue;
      seen.add(row.candidate.placeId);
      pool.push(row.candidate);
      if (solo && row.affinity !== null) discoveryAffinity.set(row.candidate.placeId, row.affinity);
    }
  }
  return { pool, discoveryAffinity };
}

function interleaveCap(candidates: Candidate[], cap: number): Candidate[] {
  // Pool is already interleaved by mergeCandidates; keep order, cap to one scoring query.
  return candidates.slice(0, cap);
}

function toCard(
  s: ScoredCandidate,
  participants: ParticipantView[],
  constraints: Constraints,
  priceMax: number | null,
): RecommendationCard {
  const c = s.candidate;
  const day = constraints.timeWindow ? weekdayOf(constraints.timeWindow.date) : WEEKDAYS[0];
  const hoursText = constraints.timeWindow ? hoursTextFor(c.hours, day) : null;
  const links: RecommendationCard['links'] = [];
  if (c.website) links.push({ label: 'Website', url: c.website });
  if (c.externalUrl) links.push({ label: c.externalUrl.includes('resy.com') ? 'Resy' : 'Google Maps', url: c.externalUrl });
  const venueFacts: RecommendationCard['evidence']['venueFacts'] = [];
  if (c.address) venueFacts.push({ field: 'address', value: c.address, source: 'qloo' });
  if (c.priceLevel !== null) venueFacts.push({ field: 'price_level', value: '$'.repeat(c.priceLevel), source: 'qloo' });
  if (hoursText) venueFacts.push({ field: 'hours', value: hoursText, source: 'qloo' });
  if (s.distanceM !== null)
    venueFacts.push({ field: 'distance', value: `${(s.distanceM / 1609.344).toFixed(1)} mi (straight-line)`, source: 'computed' });
  const cuisines = cuisineNames(c.tagIds, c.tagNames);
  if (cuisines.length) venueFacts.push({ field: 'cuisine', value: cuisines.join(', '), source: 'qloo' });
  if (s.occasionTags.length) venueFacts.push({ field: 'occasion', value: s.occasionTags.join(', '), source: 'qloo' });

  const userProvided: string[] = [];
  for (const p of participants) {
    if (p.displayLikes.length) userProvided.push(`${p.displayName} likes ${p.displayLikes.slice(0, 3).join(', ')}`);
  }
  if (noveltyApplied(constraints))
    userProvided.push(participants.length > 1 ? 'Excluding places either of you has visited' : "Excluding places you've visited");
  const qlooSignals = participants.map((p) => {
    const sc = s.scores[p.key as ParticipantKey]!;
    return `Rank ${sc.rank + 1} of ${sc.poolSize} for ${p.displayName}'s taste signals`;
  });

  return {
    placeId: c.placeId,
    name: c.name,
    address: c.address,
    distanceM: s.distanceM,
    priceLevel: c.priceLevel,
    cuisines,
    hoursStatus: s.hoursStatus,
    hoursText,
    novelty: noveltyApplied(constraints) ? 'new_to_everyone' : 'not_checked',
    reasons: templateReasons(s, participants, noveltyApplied(constraints), priceMax),
    evidence: { userProvided, qlooSignals, venueFacts },
    links,
    utilities: Object.fromEntries(Object.entries(s.scores).map(([k, v]) => [k, v!.utility])),
    ranks: Object.fromEntries(Object.entries(s.scores).map(([k, v]) => [k, { rank: v!.rank + 1, of: v!.poolSize }])),
    imageUrl: c.imageUrl,
    occasionTags: s.occasionTags,
  };
}
