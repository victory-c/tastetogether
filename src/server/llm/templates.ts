import { copy } from '@/copy/en';
import { metersToMiles } from '@/domain/geo';
import type { ParticipantKey, ParticipantView, ScoredCandidate } from '@/domain/types';

function topPct(rank: number, poolSize: number): number {
  return Math.min(100, Math.max(1, Math.ceil(((rank + 1) / Math.max(1, poolSize)) * 100)));
}

/** Deterministic English reasons built only from structured facts. Always available. */
export function templateReasons(
  s: ScoredCandidate,
  participants: ParticipantView[],
  excludeVisited: boolean,
  priceMax: number | null,
): string[] {
  const out: string[] = [];
  const [a, b] = participants;
  const score = (k: ParticipantKey) => s.scores[k]!;
  if (a && b) {
    out.push(
      copy.reasons.bothRank(
        a.displayName,
        b.displayName,
        topPct(score('A').rank, score('A').poolSize),
        topPct(score('B').rank, score('B').poolSize),
      ),
    );
  } else if (a) {
    out.push(copy.reasons.soloRank(a.displayName, topPct(score('A').rank, score('A').poolSize)));
    out.push(copy.reasons.basedOn(a.displayName, a.positiveEntityNames));
  }
  if (excludeVisited) out.push(b ? copy.reasons.newToBoth : copy.reasons.newToYou);
  if (priceMax !== null && s.candidate.priceLevel !== null) out.push(copy.reasons.priceFits(s.candidate.priceLevel));
  else if (s.distanceM !== null) out.push(copy.reasons.distance(metersToMiles(s.distanceM).toFixed(1)));
  return out.slice(0, 3);
}
