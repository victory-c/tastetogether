import { matchExcludedCuisine } from './cuisines';
import { haversineM } from './geo';
import { hoursStatusAt } from './hours';
import type { Candidate, Constraints, Exclusion, ParticipantView } from './types';

export interface FilterInput {
  candidates: Candidate[];
  participants: ParticipantView[];
  constraints: Constraints;
  /** Places rejected with "Try another" in this session. Not permanent dislikes. */
  rejectedThisSession: string[];
}

export interface FilterOutput {
  kept: Candidate[];
  excluded: Exclusion[];
}

/** Effective price ceiling: the strictest of the session limit and every participant's limit. */
export function effectivePriceMax(constraints: Constraints, participants: ParticipantView[]): number | null {
  const limits = [constraints.priceMax, ...participants.map((p) => p.priceMax)].filter((v): v is NonNullable<typeof v> => v !== null);
  if (limits.length === 0) return null;
  const base = Math.min(...limits);
  return constraints.relaxations.includes('raise_price') ? Math.min(4, base + 1) : base;
}

export function effectiveRadiusM(constraints: Constraints): number | null {
  if (!constraints.area) return null;
  return constraints.relaxations.includes('expand_radius') ? constraints.area.radiusM * 1.5 : constraints.area.radiusM;
}

/**
 * Hard constraints, applied before any ranking. One participant's hard constraint
 * (cuisine exclusion, price limit, history) can never be cancelled by the other.
 * Unknown values (null price, null location) are kept and surfaced as unknowns, not silently passed as "meets".
 */
export function applyHardFilters(input: FilterInput): FilterOutput {
  const { candidates, participants, constraints, rejectedThisSession } = input;
  const priceMax = effectivePriceMax(constraints, participants);
  const radius = effectiveRadiusM(constraints);
  const excludeVisited = constraints.excludeVisited && !constraints.relaxations.includes('allow_revisits');
  const rejected = new Set(rejectedThisSession);
  const kept: Candidate[] = [];
  const excluded: Exclusion[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    if (seen.has(c.placeId)) continue;
    seen.add(c.placeId);
    const exclusion = firstExclusion(c);
    if (exclusion) excluded.push(exclusion);
    else kept.push(c);
  }
  return { kept, excluded };

  function firstExclusion(c: Candidate): Exclusion | null {
    const ex = (reason: Exclusion['reason'], participant: Exclusion['participant'] = null): Exclusion => ({
      placeId: c.placeId,
      reason,
      participant,
    });
    if (c.isClosed === true) return ex('closed_permanently');
    if (rejected.has(c.placeId)) return ex('rejected_this_session');
    if (constraints.area && radius !== null && c.location && haversineM(constraints.area.center, c.location) > radius)
      return ex('outside_area');
    if (priceMax !== null && c.priceLevel !== null && c.priceLevel > priceMax) return ex('over_budget');
    for (const p of participants) {
      if (matchExcludedCuisine(c.tagIds, p.excludedCuisines)) return ex('excluded_cuisine', p.key);
    }
    for (const p of participants) {
      if (p.dismissedPlaceIds.includes(c.placeId)) return ex('dismissed', p.key);
    }
    if (excludeVisited) {
      for (const p of participants) {
        if (p.visitedPlaceIds.includes(c.placeId)) return ex('visited', p.key);
      }
    }
    // Known closed at the chosen time is always excluded; requireOpen additionally holds back unverified hours (decision.ts).
    if (constraints.timeWindow && hoursStatusAt(c.hours, constraints.timeWindow) === 'closed_at_start') {
      return ex('closed_in_window');
    }
    return null;
  }
}
