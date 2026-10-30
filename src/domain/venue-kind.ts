// What kind of outing a venue supports, from Qloo genre and occasion tags. Pure, no I/O.

import type { Occasion, TimeWindow } from './types';

const GENRE_PREFIX = 'urn:tag:genre:place:restaurant:';

/**
 * Word tokens (genre slugs split on "_") that mark drinks, desserts or baked goods rather than a meal.
 * Token match, not substring, so "tea" never matches "steakhouse".
 */
const NON_MEAL_TOKENS = new Set([
  'cafe',
  'coffee',
  'espresso',
  'tea',
  'boba',
  'juice',
  'smoothie',
  'bakery',
  'pastry',
  'patisserie',
  'cake',
  'cupcake',
  'dessert',
  'ice',
  'gelato',
  'yogurt',
  'donut',
  'doughnut',
  'chocolate',
  'creperie',
  'confectionery',
  'candy',
]);

/**
 * Words that make up drink-only bar genres. A genre is drink-only when ALL its tokens are in this set,
 * so "lounge_bar" or "cocktail_bar" are drinks while "sushi_bar" or "tapas_bar" still count as meals.
 */
const DRINK_TOKENS = new Set([
  'bar',
  'cocktail',
  'wine',
  'beer',
  'lounge',
  'live',
  'music',
  'dive',
  'sports',
  'sake',
  'whiskey',
  'karaoke',
  'hookah',
  'pub',
  'brewery',
  'garden',
  'speakeasy',
  'nightclub',
  'taproom',
  'tap',
  'room',
]);

/** Genres that describe style or diet rather than what is served, so they don't make a place a meal on their own. */
const MODIFIERS = new Set(['breakfast', 'brunch', 'organic', 'vegan', 'vegetarian', 'health_food', 'takeout', 'caterer', 'gluten_free']);

/** Cafés and bakeries are reasonable for breakfast; before this hour they stay in the pool. */
const BREAKFAST_FROM = '05:00';
const BREAKFAST_UNTIL = '11:00';

export function genreSlugs(tagIds: string[]): string[] {
  return tagIds.filter((id) => id.startsWith(GENRE_PREFIX)).map((id) => id.slice(GENRE_PREFIX.length));
}

/**
 * A venue is "not a meal" when every genre Qloo gives it is a drink/dessert/bakery/bar genre or a
 * modifier, and at least one is a drink/dessert/bakery genre. Venues without genre tags are kept.
 */
export function isNonMealVenue(tagIds: string[], window: TimeWindow | null): boolean {
  const slugs = genreSlugs(tagIds);
  if (slugs.length === 0) return false;
  // A breakfast-time window lifts only the café/bakery rule; drink-only bars are never a meal.
  const breakfast = window !== null && window.start >= BREAKFAST_FROM && window.start < BREAKFAST_UNTIL;
  const nonMeal = (slug: string) => {
    const tokens = slug.split('_');
    return tokens.every((t) => DRINK_TOKENS.has(t)) || (!breakfast && tokens.some((t) => NON_MEAL_TOKENS.has(t)));
  };
  return slugs.some(nonMeal) && slugs.every((s) => nonMeal(s) || MODIFIERS.has(s));
}

/** Qloo tags that indicate a venue suits an occasion. Soft preference only: never a filter. */
export const OCCASION_TAGS: Record<Occasion, string[]> = {
  date: [
    'urn:tag:event:place:date_night',
    'urn:tag:ambience:qloo:romantic',
    'urn:tag:ambience:qloo:intimate',
    'urn:tag:visit_intent:qloo:special_occasion',
    'urn:tag:event:place:anniversary',
  ],
  friends: [
    'urn:tag:customer_identity:qloo:groups_of_friends',
    'urn:tag:ambience:place:large_group',
    'urn:tag:ambience:qloo:lively',
    'urn:tag:interests:qloo:casual_socializing',
  ],
  business: [
    'urn:tag:customer_identity:qloo:business_professionals',
    'urn:tag:event:place:work_dinner',
    'urn:tag:ambience:qloo:quiet',
    'urn:tag:noise_level:qloo:quiet',
  ],
};

/** Qloo tag names on this venue that match the occasion, for display and tie-breaking. */
export function occasionMatches(tagIds: string[], tagNames: string[], occasion: Occasion | null): string[] {
  if (!occasion) return [];
  const wanted = new Set(OCCASION_TAGS[occasion]);
  const out: string[] = [];
  tagIds.forEach((id, i) => {
    const name = tagNames[i];
    if (wanted.has(id) && name && !out.includes(name)) out.push(name);
  });
  return out;
}
