import { describe, expect, it } from 'vitest';
import { isNonMealVenue, occasionMatches } from '@/domain/venue-kind';
import { applyHardFilters } from '@/domain/filters';
import { candidate, constraints, participant } from './helpers';

const g = (...slugs: string[]) => slugs.map((s) => `urn:tag:genre:place:restaurant:${s}`);

describe('meal vs non-meal venues', () => {
  it('treats coffee, bakery and dessert-only places as not a meal', () => {
    expect(isNonMealVenue(g('coffee_shop'), null)).toBe(true);
    expect(isNonMealVenue(g('cake_shop', 'wedding_bakery', 'dessert_shop'), null)).toBe(true);
    expect(isNonMealVenue(g('tea_house'), null)).toBe(true);
    expect(isNonMealVenue(g('bakery', 'breakfast'), null)).toBe(true);
    expect(isNonMealVenue(g('bar', 'cocktail_bar', 'live_music_bar'), null)).toBe(true);
    expect(isNonMealVenue(g('bar', 'cocktail_bar', 'lounge_bar'), null)).toBe(true);
  });
  it('keeps real meals, including bakeries that also serve meals', () => {
    expect(isNonMealVenue(g('steakhouse'), null)).toBe(false);
    expect(isNonMealVenue(g('bakery', 'pizza'), null)).toBe(false);
    expect(isNonMealVenue(g('pizza', 'beer_garden'), null)).toBe(false);
    expect(isNonMealVenue(g('sushi_bar'), null)).toBe(false);
    expect(isNonMealVenue(g('brunch', 'tapas_bar', 'spanish'), null)).toBe(false);
    expect(isNonMealVenue(g('breakfast', 'bar', 'sandwich_shop', 'cafe'), null)).toBe(false);
    expect(isNonMealVenue([], null)).toBe(false);
  });
  it('allows cafés and bakeries for a breakfast-time window', () => {
    expect(isNonMealVenue(g('cafe'), { date: '2026-10-31', start: '08:30', end: '09:30' })).toBe(false);
    expect(isNonMealVenue(g('cafe'), { date: '2026-10-31', start: '18:30', end: '20:00' })).toBe(true);
    expect(isNonMealVenue(g('cafe'), { date: '2026-10-31', start: '00:30', end: '01:30' })).toBe(true);
    expect(isNonMealVenue(g('cocktail_bar'), { date: '2026-10-31', start: '09:00', end: '10:00' })).toBe(true);
  });
  it('excludes non-meal venues in hard filters with a reason', () => {
    const out = applyHardFilters({
      candidates: [candidate('cafe', { tagIds: g('coffee_shop') }), candidate('meal', { tagIds: g('thai') })],
      participants: [participant('A')],
      constraints: constraints(),
      rejectedThisSession: [],
    });
    expect(out.kept.map((c) => c.placeId)).toEqual(['meal']);
    expect(out.excluded).toEqual([{ placeId: 'cafe', reason: 'not_a_meal', participant: null }]);
  });
});

describe('occasion tags', () => {
  it('returns matching Qloo tag names only for the requested occasion', () => {
    const ids = ['urn:tag:event:place:date_night', 'urn:tag:customer_identity:qloo:groups_of_friends'];
    const names = ['Date night', 'Groups of friends'];
    expect(occasionMatches(ids, names, 'date')).toEqual(['Date night']);
    expect(occasionMatches(ids, names, 'friends')).toEqual(['Groups of friends']);
    expect(occasionMatches(ids, names, null)).toEqual([]);
  });
});
