// Real Qloo end-to-end smoke test of the coordinator: A alone, B alone, A+B together.
// Usage: npm run qloo:smoke   (reads QLOO_API_KEY from .env.local)
import { discover, QlooBudget, scoreCandidates } from '../src/server/qloo/client';
import { coordinate, type QlooPort } from '../src/server/services/coordinator';
import { DEMO_CONSTRAINTS } from '../src/server/services/demo-data';
import type { ParticipantView } from '../src/domain/types';

const base = {
  profileVersion: 1,
  excludedCuisines: [] as string[],
  priceMax: null,
  dismissedPlaceIds: [] as string[],
  hasUnresolvedHistory: false,
};
const A: ParticipantView = {
  ...base,
  key: 'A',
  profileId: 'smoke-a',
  displayName: 'Alex',
  positiveEntityIds: ['FB20C89B-2337-4F71-9B28-DF2A7360B73A'],
  positiveEntityNames: ['Chez Panisse'],
  displayLikes: ['Chez Panisse'],
  visitedPlaceIds: ['EC35A34F-462E-431B-AD3A-08D722667FB3'],
};
const B: ParticipantView = {
  ...base,
  key: 'B',
  profileId: 'smoke-b',
  displayName: 'Jordan',
  positiveEntityIds: ['74018DD4-A14F-4AB3-9859-55F140F1DA20'],
  positiveEntityNames: ['Cheese Board Pizza'],
  displayLikes: ['Cheese Board Pizza'],
  visitedPlaceIds: [],
  excludedCuisines: ['sushi'],
};

async function main() {
  for (const [label, people] of [
    ['A', [A]],
    ['B', [{ ...B, key: 'A' as const }]],
    ['A+B', [A, B]],
  ] as const) {
    const budget = new QlooBudget(8);
    const qloo: QlooPort = {
      discover: (r, p) => discover({ ...r, priceMax: r.priceMax as 1 | 2 | 3 | 4 | null }, budget, p),
      score: (s, ids, p) => scoreCandidates(s, ids, budget, p),
    };
    const t = Date.now();
    const { result, evidence } = await coordinate({
      participants: [...people],
      constraints: DEMO_CONSTRAINTS,
      rejectedThisSession: [],
      qloo,
      runId: 'smoke',
      now: new Date(),
    });
    console.log(
      `\n== ${label}: ${result.status} in ${Date.now() - t}ms, calls=${budget.refs.length}, ranked=${evidence.ranked.length}, excluded=${JSON.stringify(result.exclusionSummary)}`,
    );
    for (const c of result.cards)
      console.log(`  - ${c.name} | ${c.address} | $${c.priceLevel ?? '?'} | ${JSON.stringify(c.utilities)}\n    ${c.reasons.join(' / ')}`);
    if (result.cards.some((c) => c.placeId === 'EC35A34F-462E-431B-AD3A-08D722667FB3')) throw new Error('visited place leaked');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
