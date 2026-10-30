import { describe, expect, it } from 'vitest';

import { percentiles, rankDuo, residuals, zScores, type PoolItem } from './rank';

const item = (id: string, popularity: number, affinityA: number, affinityB: number, contextBonus = 0): PoolItem => ({
  id,
  popularity,
  affinityA,
  affinityB,
  contextBonus,
  rating: 4.5,
});

describe('normalisation helpers', () => {
  it('z-scores are scale free', () => {
    expect(zScores([0.7, 0.75, 0.8])).toEqual(zScores([7, 7.5, 8]));
  });

  it('residuals remove the popularity trend', () => {
    const pop = zScores([1, 2, 3, 4]);
    const aff = zScores([1, 2, 3, 4]);
    for (const r of residuals(aff, pop)) expect(Math.abs(r)).toBeLessThan(1e-9);
  });

  it('percentiles give the max 1 and the min 0', () => {
    expect(percentiles([3, 1, 2])).toEqual([1, 0, 0.5]);
  });
});

describe('rankDuo', () => {
  it('prefers a place both people like over one only one person loves', () => {
    const ranked = rankDuo([
      item('a-only', 0.5, 0.95, 0.7),
      item('b-only', 0.5, 0.7, 0.95),
      item('both', 0.5, 0.88, 0.88),
      item('neither', 0.5, 0.7, 0.7),
    ]);
    expect(ranked[0]?.id).toBe('both');
    expect(ranked.at(-1)?.id).toBe('neither');
  });

  it('is not fooled by different affinity scales between people', () => {
    // B's raw affinities are uniformly higher; the fair pick should still be the shared favourite.
    const ranked = rankDuo([item('x', 0.4, 0.7, 0.8), item('y', 0.4, 0.74, 0.84), item('z', 0.4, 0.72, 0.81)]);
    expect(ranked[0]?.id).toBe('y');
  });

  it('does not let raw popularity win on its own', () => {
    const ranked = rankDuo([
      item('famous', 0.99, 0.8, 0.8),
      item('niche-fit', 0.3, 0.79, 0.79),
      item('filler-1', 0.6, 0.74, 0.74),
      item('filler-2', 0.7, 0.75, 0.75),
    ]);
    expect(ranked[0]?.id).toBe('niche-fit');
  });

  it('returns ranks per person', () => {
    const ranked = rankDuo([item('p', 0.5, 0.9, 0.7), item('q', 0.5, 0.7, 0.9)]);
    const p = ranked.find((r) => r.id === 'p')!;
    expect(p.rankA).toBe(1);
    expect(p.rankB).toBe(2);
  });
});
