import { haversineM } from './geo';
import { hoursStatusAt } from './hours';
import type { Candidate, Constraints, Exclusion, ParticipantKey, ParticipantScore, ScoredCandidate } from './types';

/** Affinities from ONE scoring query per participant: placeId -> affinity. */
export type AffinityTable = Partial<Record<ParticipantKey, Map<string, number>>>;

/**
 * Convert one participant's raw affinities into rank utilities. Raw affinity values are
 * only compared within the same query; across participants we compare ranks.
 */
export function rankUtilities(affinities: Map<string, number>): Map<string, ParticipantScore> {
  const ordered = [...affinities.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const n = ordered.length;
  const out = new Map<string, ParticipantScore>();
  ordered.forEach(([placeId, affinity], rank) => {
    out.set(placeId, { affinity, rank, utility: n <= 1 ? 1 : 1 - rank / (n - 1), poolSize: n });
  });
  return out;
}

export interface RankOutput {
  ranked: ScoredCandidate[];
  /** Candidates that lack a score from some participant. Not ranked; never given an invented score. */
  missingScores: Exclusion[];
}

/**
 * Fair ordering: maximize the worse-off participant's utility first (min), then the mean,
 * then verified straight-line distance, then placeId for determinism.
 */
export function rankCandidates(
  candidates: Candidate[],
  participants: ParticipantKey[],
  affinities: AffinityTable,
  constraints: Constraints,
): RankOutput {
  const utilities = new Map<ParticipantKey, Map<string, ParticipantScore>>();
  for (const key of participants) {
    const table = affinities[key];
    // Only rank among candidates still in play so utilities reflect the filtered pool.
    const inPlay = new Map<string, number>();
    for (const c of candidates) {
      const a = table?.get(c.placeId);
      if (a !== undefined) inPlay.set(c.placeId, a);
    }
    utilities.set(key, rankUtilities(inPlay));
  }

  const ranked: ScoredCandidate[] = [];
  const missingScores: Exclusion[] = [];
  for (const c of candidates) {
    const scores: Partial<Record<ParticipantKey, ParticipantScore>> = {};
    let missing: ParticipantKey | null = null;
    for (const key of participants) {
      const s = utilities.get(key)?.get(c.placeId);
      if (s) scores[key] = s;
      else missing ??= key;
    }
    if (missing) {
      missingScores.push({ placeId: c.placeId, reason: 'missing_score', participant: missing });
      continue;
    }
    const us = participants.map((k) => scores[k]!.utility);
    ranked.push({
      candidate: c,
      scores,
      minUtility: Math.min(...us),
      meanUtility: us.reduce((a, b) => a + b, 0) / us.length,
      distanceM: constraints.area && c.location ? haversineM(constraints.area.center, c.location) : null,
      hoursStatus: hoursStatusAt(c.hours, constraints.timeWindow),
    });
  }

  ranked.sort(
    (a, b) =>
      b.minUtility - a.minUtility ||
      b.meanUtility - a.meanUtility ||
      (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY) ||
      a.candidate.placeId.localeCompare(b.candidate.placeId),
  );
  return { ranked, missingScores };
}
