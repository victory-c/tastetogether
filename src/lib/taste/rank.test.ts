import { describe, expect, it } from 'vitest';

import { percentiles, rankDuo, residuals, vibeShare, zScores, type PoolItem } from './rank';

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

describe('vibeShare', () => {
  const place = new Set(['vegetarian', 'vegetarian meals', 'outdoor seating']);

  it('counts each ask once, however many of its synonyms a place has', () => {
    expect(vibeShare(place, [['Vegetarian', 'Vegetarian meals'], ['Quiet']])).toBe(0.5);
    expect(vibeShare(place, [['Vegetarian'], ['Outdoor seating']])).toBe(1);
  });

  it('is 0 without a vibe', () => {
    expect(vibeShare(place, [])).toBe(0);
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

  it('lets a typed vibe lift a place that still fits both people', () => {
    const pool = (vibeMatch: number) => [
      item('best', 0.5, 0.95, 0.95),
      { ...item('good', 0.5, 0.9, 0.9), vibeMatch },
      item('mid', 0.5, 0.8, 0.8),
      item('low', 0.5, 0.7, 0.7),
      item('lowest', 0.5, 0.6, 0.6),
    ];
    expect(rankDuo(pool(0))[0]?.id).toBe('best');
    expect(rankDuo(pool(1))[0]?.id).toBe('good');
  });

  it('gives no vibe lift to a weak fit for either person or to a place closed at plan time', () => {
    const fairOf = (pool: PoolItem[], id: string) => rankDuo(pool).find((r) => r.id === id)!.fair;
    const base = [item('a', 0.5, 0.9, 0.9), item('b', 0.5, 0.8, 0.8), item('c', 0.5, 0.7, 0.7)];
    const lopsided = (vibeMatch: number) => [...base, { ...item('one-sided', 0.5, 0.95, 0.6), vibeMatch }];
    expect(fairOf(lopsided(1), 'one-sided')).toBe(fairOf(lopsided(0), 'one-sided'));
    const closed = (vibeMatch: number) => [...base, { ...item('closed', 0.5, 0.95, 0.95), vibeMatch, penalty: 1 }];
    expect(fairOf(closed(1), 'closed')).toBe(fairOf(closed(0), 'closed'));
  });

  it('returns ranks per person', () => {
    const ranked = rankDuo([item('p', 0.5, 0.9, 0.7), item('q', 0.5, 0.7, 0.9)]);
    const p = ranked.find((r) => r.id === 'p')!;
    expect(p.rankA).toBe(1);
    expect(p.rankB).toBe(2);
  });
});
