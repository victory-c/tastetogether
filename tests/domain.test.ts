import { describe, expect, it } from 'vitest';
import { applyHardFilters } from '@/domain/filters';
import { rankCandidates, rankUtilities } from '@/domain/ranking';
import { hoursStatusAt, weekdayOf } from '@/domain/hours';
import { selectForMode } from '@/domain/decision';
import { reasonsAreSafe } from '@/domain/validate';
import { candidate, constraints, participant } from './helpers';

const window = { date: '2026-10-30', start: '18:00', end: '19:00' };

describe('hard filters', () => {
  it('enforces both participants, session rejection, price and radius while keeping unknowns', () => {
    const places = [
      candidate('a'),
      candidate('b'),
      candidate('rejected'),
      candidate('thai', { tagIds: ['urn:tag:cuisine:qloo:thai'] }),
      candidate('pizza', { tagIds: ['urn:tag:cuisine:qloo:pizza'] }),
      candidate('expensive', { priceLevel: 3 }),
      candidate('far', { location: { lat: 38, lon: -122 } }),
      candidate('unknown'),
    ];
    const result = applyHardFilters({
      candidates: places,
      participants: [
        participant('A', { visitedPlaceIds: ['a'], excludedCuisines: ['thai'], priceMax: 3 }),
        participant('B', { visitedPlaceIds: ['b'], excludedCuisines: ['pizza'], priceMax: 2 }),
      ],
      constraints: constraints({ priceMax: 4 }),
      rejectedThisSession: ['rejected'],
    });
    expect(result.kept.map((c) => c.placeId)).toEqual(['unknown']);
    expect(result.excluded.map((e) => e.reason)).toEqual([
      'visited',
      'visited',
      'rejected_this_session',
      'excluded_cuisine',
      'excluded_cuisine',
      'over_budget',
      'outside_area',
    ]);
  });
  it('allows revisits only when relaxed and excludes confirmed closed hours', () => {
    const result = applyHardFilters({
      candidates: [candidate('visited'), candidate('closed', { hours: { thursday: [], friday: [] } })],
      participants: [participant('A', { visitedPlaceIds: ['visited'] })],
      constraints: constraints({ relaxations: ['allow_revisits'], requireOpen: true, timeWindow: window }),
      rejectedThisSession: [],
    });
    expect(result.kept.map((c) => c.placeId)).toEqual(['visited']);
    expect(result.excluded[0]?.reason).toBe('closed_in_window');
  });
});

describe('ranking and selection', () => {
  it('uses minimum utility before mean and excludes missing scores', () => {
    const places = ['x', 'y', 'z', 'missing'].map((id) => candidate(id));
    const result = rankCandidates(
      places,
      ['A', 'B'],
      {
        A: new Map([
          ['x', 4],
          ['y', 3],
          ['z', 2],
          ['missing', 1],
        ]),
        B: new Map([
          ['z', 3],
          ['y', 2],
          ['x', 1],
        ]),
      },
      constraints(),
    );
    expect(result.ranked[0]?.candidate.placeId).toBe('y');
    expect(result.missingScores).toEqual([{ placeId: 'missing', reason: 'missing_score', participant: 'B' }]);
    expect(result.ranked.flatMap((r) => Object.values(r.scores)).every((s) => s.utility >= 0 && s.utility <= 1)).toBe(true);
    expect(result.ranked[0]?.scores.A?.poolSize).toBe(4);
  });
  it('breaks ties deterministically and reports pool size', () => {
    expect(
      [
        ...rankUtilities(
          new Map([
            ['b', 1],
            ['a', 1],
          ]),
        ).entries(),
      ].map(([id, s]) => [id, s.rank, s.poolSize]),
    ).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
    ]);
    const result = rankCandidates(
      [candidate('b'), candidate('a')],
      ['A'],
      {
        A: new Map([
          ['b', 1],
          ['a', 1],
        ]),
      },
      constraints(),
    );
    expect(result.ranked.map((r) => r.candidate.placeId)).toEqual(['a', 'b']);
  });
  it('uses distance and place ID to break equal fairness scores', () => {
    const scores = {
      A: new Map([
        ['a', 2],
        ['b', 1],
      ]),
      B: new Map([
        ['b', 2],
        ['a', 1],
      ]),
    };
    const same = rankCandidates([candidate('b'), candidate('a')], ['A', 'B'], scores, constraints());
    expect(same.ranked.map((r) => r.candidate.placeId)).toEqual(['a', 'b']);
    const distances = rankCandidates(
      [candidate('a', { location: { lat: 37.005, lon: -122 } }), candidate('b', { location: { lat: 37.001, lon: -122 } })],
      ['A', 'B'],
      scores,
      constraints(),
    );
    expect(distances.ranked.map((r) => r.candidate.placeId)).toEqual(['b', 'a']);
  });
  it('never pads three, picks one, and holds unverified hours', () => {
    const ranked = rankCandidates(
      [candidate('a'), candidate('b')],
      ['A'],
      {
        A: new Map([
          ['a', 2],
          ['b', 1],
        ]),
      },
      constraints(),
    ).ranked;
    expect(selectForMode(ranked, constraints()).selected).toHaveLength(2);
    expect(selectForMode(ranked, constraints({ decisionMode: 'pick' })).selected).toHaveLength(1);
    expect(selectForMode(ranked, constraints({ requireOpen: true, timeWindow: window }))).toEqual({
      selected: [],
      heldForUnverifiedHours: 2,
    });
  });
});

describe('hours', () => {
  it('handles open, closed, unknown, overnight and weekday', () => {
    expect(weekdayOf(window.date)).toBe('friday');
    expect(hoursStatusAt({ thursday: [], friday: [{ opens: '17:00', closes: '20:00' }] }, window)).toBe('open_at_start');
    expect(hoursStatusAt({ thursday: [], friday: [] }, window)).toBe('closed_at_start');
    expect(hoursStatusAt({ thursday: [] }, window)).toBe('unverified');
    expect(hoursStatusAt(null, window)).toBe('unverified');
    expect(hoursStatusAt({ thursday: [{ opens: '22:00', closes: '02:00' }], friday: [] }, { ...window, start: '01:00' })).toBe(
      'open_at_start',
    );
  });
});

describe('explanation safety', () => {
  const safe = (reasons: string[]) => reasonsAreSafe({ reasons, allowedNames: ['Place A'], forbiddenNames: ['Place B'] });
  it('accepts clean English and rejects unsupported or unsafe claims', () => {
    expect(safe(['Place A matches your preferences.'])).toBe(true);
    for (const text of ['Costs $25', 'Wait 20 minutes', '\u4e2d\u6587', 'Place B is nearby']) expect(safe([text])).toBe(false);
    expect(safe(['a', 'b', 'c', 'd', 'e'])).toBe(false);
  });
});
