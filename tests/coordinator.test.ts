import { describe, expect, it } from 'vitest';
import { copy } from '@/copy/en';
import { coordinate, ProviderUnavailableError, type CoordinatorInput, type QlooPort } from '@/server/services/coordinator';
import type { Candidate } from '@/domain/types';
import { candidate, constraints, participant } from './helpers';

const places = ['one', 'two', 'three', 'four'].map((id) => candidate(id));
function port(candidates: Candidate[]): QlooPort {
  return {
    discover: async () => candidates.map((c, i) => ({ candidate: c, affinity: 1 - i / 10 })),
    score: async (_signals, ids) => new Map(ids.map((id, i) => [id, 1 - i / 10])),
  };
}
function input(patch: Partial<CoordinatorInput> = {}): CoordinatorInput {
  return {
    participants: [participant('A'), participant('B')],
    constraints: constraints(),
    rejectedThisSession: [],
    qloo: port(places),
    runId: 'run',
    now: new Date('2026-10-30T00:00:00Z'),
    ...patch,
  };
}

describe('coordinator', () => {
  it('returns three real candidates, respecting both histories and rejected places', async () => {
    const output = await coordinate(
      input({
        participants: [participant('A'), participant('B', { visitedPlaceIds: ['one'] })],
        rejectedThisSession: ['two'],
        constraints: constraints({ budgetNote: 'Around my budget' }),
      }),
    );
    expect(output.result.status).toBe('success');
    expect(output.result.cards.map((c) => c.placeId)).toEqual(['three', 'four']);
    expect(output.result.message).toBe(copy.status.fewerThanThree(2));
    expect(output.result.unknowns).toContain(copy.unknowns.budgetNote('Around my budget'));
    expect(output.result.cards.every((c) => places.some((p) => p.name === c.name))).toBe(true);
  });
  it('returns three in three mode and one in pick mode', async () => {
    expect((await coordinate(input())).result.cards).toHaveLength(3);
    expect((await coordinate(input({ constraints: constraints({ decisionMode: 'pick' }) }))).result.cards).toHaveLength(1);
  });
  it('returns no match with relaxation options and no padding', async () => {
    const { result } = await coordinate(input({ qloo: port([]) }));
    expect(result.status).toBe('no_match');
    expect(result.cards).toEqual([]);
    expect(result.relaxationOptions).toContain('expand_radius');
  });
  it('asks for missing area or positive signals', async () => {
    expect((await coordinate(input({ constraints: constraints({ area: null }) }))).result.status).toBe('needs_clarification');
    expect((await coordinate(input({ participants: [participant('A', { positiveEntityIds: [] })] }))).result.status).toBe(
      'needs_clarification',
    );
  });
  it('handles provider unavailability without cards', async () => {
    const qloo: QlooPort = {
      discover: async () => {
        throw new ProviderUnavailableError();
      },
      score: async () => new Map(),
    };
    const { result } = await coordinate(input({ qloo }));
    expect(result.status).toBe('provider_unavailable');
    expect(result.cards).toEqual([]);
  });
  it('keeps templates for an incomplete writer response', async () => {
    const { result } = await coordinate(input({ writeReasons: async (cards) => new Map([[cards[0]!.placeId, ['Costs $40']]]) }));
    expect(result.explanationSource).toBe('template');
    expect(result.cards.every((c) => !c.reasons.includes('Costs $40'))).toBe(true);
  });
  it('rejects a complete writer response containing unsafe text', async () => {
    const { result } = await coordinate(input({ writeReasons: async (cards) => new Map(cards.map((c) => [c.placeId, ['Costs $40']])) }));
    expect(result.explanationSource).toBe('template');
    expect(result.cards.every((c) => !c.reasons.includes('Costs $40'))).toBe(true);
  });
});
