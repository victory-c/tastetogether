import type { Constraints, DecisionMode, ExclusionReason, Relaxation, ScoredCandidate, Exclusion } from './types';

export function wantedCount(mode: DecisionMode): number {
  return mode === 'pick' ? 1 : 3;
}

/**
 * Apply the decision mode. Never pads: if fewer qualify than wanted, return what we have.
 * With requireOpen, venues with unverified hours are held back so we never claim all conditions are met.
 */
export function selectForMode(
  ranked: ScoredCandidate[],
  constraints: Constraints,
): { selected: ScoredCandidate[]; heldForUnverifiedHours: number } {
  const want = wantedCount(constraints.decisionMode);
  let pool = ranked;
  let held = 0;
  if (constraints.requireOpen && constraints.timeWindow) {
    pool = ranked.filter((r) => r.hoursStatus === 'open_at_start');
    held = ranked.length - pool.length;
  }
  return { selected: pool.slice(0, want), heldForUnverifiedHours: held };
}

export function summarizeExclusions(excluded: Exclusion[]): { reason: ExclusionReason; count: number }[] {
  const counts = new Map<ExclusionReason, number>();
  for (const e of excluded) counts.set(e.reason, (counts.get(e.reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

/** Which relaxations would plausibly help, based on why candidates were excluded. Offered, never applied. */
export function suggestRelaxations(excluded: Exclusion[], constraints: Constraints): Relaxation[] {
  const reasons = new Set(excluded.map((e) => e.reason));
  const out: Relaxation[] = [];
  if (!constraints.relaxations.includes('expand_radius')) out.push('expand_radius');
  if (reasons.has('over_budget') && !constraints.relaxations.includes('raise_price')) out.push('raise_price');
  if (reasons.has('visited') && !constraints.relaxations.includes('allow_revisits')) out.push('allow_revisits');
  return out;
}
