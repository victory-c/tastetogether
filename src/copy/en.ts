// All user-facing product text. English only, regardless of browser language or input language.
// Page-specific strings live in their own files (home.ts, taste.ts, room.ts) owned by those pages.

import type { ApiErrorCode } from '@/lib/api-types';
import type { ExclusionReason, HoursStatus, Relaxation } from '@/domain/types';
import { home } from './home';
import { room } from './room';
import { taste } from './taste';

const errors: Record<ApiErrorCode, string> = {
  unauthenticated: 'Your session has ended. Refresh the page to continue.',
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find that.",
  invalid_input: 'Some of the details look off. Check them and try again.',
  conflict: 'Something changed while you were editing. Refresh to see the latest version.',
  profile_required: 'Set up your taste profile first.',
  session_expired: 'This invite has expired or was revoked. Ask your friend for a new link.',
  rate_limited: "We've hit our recommendation limit for now. Please try again in a few minutes.",
  provider_unavailable: "Our restaurant data source isn't responding right now. Please try again.",
  internal: 'Something went wrong on our side. Please try again.',
};

const exclusionReasons: Record<ExclusionReason, string> = {
  outside_area: 'outside the search area',
  over_budget: 'above the price level',
  excluded_cuisine: "a cuisine one of you doesn't eat",
  closed_permanently: 'permanently closed',
  closed_in_window: 'closed at your time',
  visited: 'already visited by one of you',
  dismissed: 'marked as not interested',
  rejected_this_session: 'skipped in this session',
  missing_score: 'not enough signal for both of you',
  not_a_meal: 'a café, bar or dessert shop rather than a meal',
};

/** Count-friendly labels for "Filtered out: ..." lines. */
const exclusionCounts: Record<ExclusionReason, (n: number) => string> = {
  outside_area: (n) => `${n} outside the area`,
  over_budget: (n) => `${n} over the price limit`,
  excluded_cuisine: (n) => `${n} with an excluded cuisine`,
  closed_permanently: (n) => `${n} permanently closed`,
  closed_in_window: (n) => `${n} closed at your time`,
  visited: (n) => `${n} already visited`,
  dismissed: (n) => `${n} marked not interested`,
  rejected_this_session: (n) => `${n} skipped this session`,
  missing_score: (n) => `${n} without enough taste signal`,
  not_a_meal: (n) => `${n} ${n === 1 ? 'café, bar or dessert shop' : 'cafés, bars and dessert shops'}`,
};

const relaxations: Record<Relaxation, string> = {
  expand_radius: 'Search a wider area',
  raise_price: 'Allow one price level higher',
  allow_revisits: 'Include places one of you has visited',
};

const hours: Record<HoursStatus, string> = {
  open_at_start: 'Open at your start time',
  closed_at_start: 'Closed at your start time',
  unverified: 'Hours unverified',
  no_time_given: 'No time selected',
};

const status = {
  needs_clarification: 'We need a bit more information before we can search.',
  no_match: 'No restaurant meets every condition you both set.',
  provider_unavailable: "We couldn't reach our restaurant data source. Nothing was recommended. Please try again.",
  fewerThanThree: (n: number) => `Only ${n} ${n === 1 ? 'place passed' : 'places passed'} your filters. We won't pad the list.`,
};

const reasons = {
  bothRank: (a: string, b: string, ra: number, rb: number, of: number) =>
    `#${ra} of ${of} for ${a} and #${rb} of ${of} for ${b}, each ranked by Qloo against your own taste.`,
  balanced: (a: string, b: string) => `A balanced pick: in the top third for both ${a} and ${b}, so neither of you settles.`,
  soloRank: (name: string, r: number, of: number) => `#${r} of ${of} for ${name}'s taste, ranked by Qloo.`,
  occasion: (tags: string[]) => `Qloo tags it as ${tags.slice(0, 2).join(' and ').toLowerCase()}.`,
  basedOn: (name: string, likes: string[]) =>
    likes.length ? `Based on ${name}'s interest in ${likes.slice(0, 2).join(' and ')}.` : `Based on ${name}'s interest signals.`,
  priceFits: (level: number) => `Price level ${'$'.repeat(level)} fits your limit.`,
  newToBoth: 'Neither of you has marked it as visited.',
  newToYou: "You haven't marked it as visited.",
  distance: (miles: string) => `About ${miles} mi away (straight-line).`,
};

const unknowns = {
  price: (n: number) => `Price level unverified for ${n} ${n === 1 ? 'place' : 'places'}.`,
  hours: (n: number) => `Hours unverified for ${n} ${n === 1 ? 'place' : 'places'}.`,
  budgetNote: (note: string) => `You mentioned "${note}". We can only filter by price level, so the final bill isn't guaranteed.`,
  wait: 'Wait time unavailable.',
  unresolvedHistory: "Some history entries aren't linked to a specific restaurant yet, so history filtering may be incomplete.",
  partialScores: (n: number) => `${n} ${n === 1 ? 'place was' : 'places were'} left out because we lacked a taste signal for one of you.`,
};

const conditions = {
  area: 'Choose a search area.',
  signals: (name: string) => `${name} needs at least one liked restaurant or interest before we can search.`,
  hoursRequired: (n: number) =>
    `${n} matching ${n === 1 ? 'place has' : 'places have'} unverified hours. Turn off "Must be open" or confirm hours yourself.`,
  partnerMissing: 'Waiting for your friend to join.',
  budget: (note: string) => `Check the price yourself: we can't verify "${note}", only the price level.`,
  confirmations: 'Both of you need to confirm the conditions.',
};

export const copy = {
  brand: 'TasteTogether',
  tagline: 'Find a place you both want to eat at.',
  sampleBadge: 'Sample',
  errors,
  exclusionReasons,
  exclusionCounts,
  relaxations,
  hours,
  status,
  reasons,
  unknowns,
  conditions,
  labels: {
    showThree: 'Show me 3 options',
    pickOne: 'Pick one for us',
    tryAnother: 'Try another',
    excludeVisited: 'Exclude places either of us has visited',
    hoursUnverified: 'Hours unverified',
    waitUnavailable: 'Wait time unavailable',
    priceUnverified: 'Price unverified',
    straightLine: 'straight-line',
  },
  sources: {
    qloo: 'Qloo Taste AI (recommendation signals and venue data)',
    user: 'Your profile and history',
  },
  home,
  taste,
  room,
};

export type Copy = typeof copy;
