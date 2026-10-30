import { haversineM } from './geo';
import { hoursStatusAt } from './hours';
import { occasionMatches } from './venue-kind';
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
  // Rank only over candidates every participant has a score for, so each person's
  // utilities are computed over the same pool and min(uA, uB) compares like with like.
  const scoredByAll = candidates.filter((c) => participants.every((k) => affinities[k]?.has(c.placeId)));
  const utilities = new Map<ParticipantKey, Map<string, ParticipantScore>>();
  for (const key of participants) {
    const table = affinities[key]!;
    utilities.set(key, rankUtilities(new Map(scoredByAll.map((c) => [c.placeId, table.get(c.placeId)!]))));
  }

  const ranked: ScoredCandidate[] = [];
  const missingScores: Exclusion[] = [];
  for (const c of candidates) {
    const scores: Partial<Record<ParticipantKey, ParticipantScore>> = {};
    let missing: ParticipantKey | null = null;
    for (const key of participants) {
      const s = utilities.get(key)?.get(c.placeId);
      if (s) scores[key] = s;
      else if (!affinities[key]?.has(c.placeId)) missing ??= key;
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
      occasionTags: occasionMatches(c.tagIds, c.tagNames, constraints.occasion),
    });
  }

  // Occasion is a soft preference: a matching Qloo occasion tag only breaks ties on min(uA, uB),
  // so it can never put a place ahead of one the worse-off person ranks higher.
  const occasionFit = (s: ScoredCandidate) => (s.occasionTags.length > 0 ? 1 : 0);
  ranked.sort(
    (a, b) =>
      b.minUtility - a.minUtility ||
      occasionFit(b) - occasionFit(a) ||
      b.meanUtility - a.meanUtility ||
      (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY) ||
      a.candidate.placeId.localeCompare(b.candidate.placeId),
  );
  return { ranked, missingScores };
}
