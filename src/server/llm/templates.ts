import { copy } from '@/copy/en';
import { metersToMiles } from '@/domain/geo';
import type { ParticipantKey, ParticipantView, ScoredCandidate } from '@/domain/types';

/** Deterministic English reasons built only from structured facts. Always available. At most three. */
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
    const sa = score('A');
    const sb = score('B');
    // "Top third" only when the 1-based rank really is within the first third for both (never for pools under 3).
    const inTopThird = (rank: number, of: number) => of >= 3 && (rank + 1) * 3 <= of;
    // Balanced picks say so; otherwise state both ranks plainly. Cards show the rank chips either way.
    if (inTopThird(sa.rank, sa.poolSize) && inTopThird(sb.rank, sb.poolSize)) out.push(copy.reasons.balanced(a.displayName, b.displayName));
    else out.push(copy.reasons.bothRank(a.displayName, b.displayName, sa.rank + 1, sb.rank + 1, sa.poolSize));
  } else if (a) {
    out.push(copy.reasons.soloRank(a.displayName, score('A').rank + 1, score('A').poolSize));
  }
  // Two people: occasion tags are already badges on the card, so don't repeat them as a reason.
  if (s.occasionTags.length && !b) out.push(copy.reasons.occasion(s.occasionTags));
  // Solo only: in a room the same "based on" line would repeat on every card.
  if (a && !b) out.push(copy.reasons.basedOn(a.displayName, a.displayLikes));
  if (excludeVisited) out.push(b ? copy.reasons.newToBoth : copy.reasons.newToYou);
  if (priceMax !== null && s.candidate.priceLevel !== null) out.push(copy.reasons.priceFits(s.candidate.priceLevel));
  else if (s.distanceM !== null) out.push(copy.reasons.distance(metersToMiles(s.distanceM).toFixed(1)));
  return out.slice(0, 3);
}
