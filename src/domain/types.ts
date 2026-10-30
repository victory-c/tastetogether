// Core domain contract. Pure types only: no I/O, no framework imports.
// Every other layer (server, API, UI) depends on these shapes.

export type PriceLevel = 1 | 2 | 3 | 4;
export type MemoryStatus = 'visited' | 'want_to_try' | 'dismissed';
export type Rating = 'liked' | 'neutral' | 'disliked';
export type DecisionMode = 'three' | 'pick';
export type Occasion = 'friends' | 'date' | 'business';
export type ParticipantKey = 'A' | 'B';

export type RunStatus = 'success' | 'needs_clarification' | 'no_match' | 'provider_unavailable';

export type SessionState = 'waiting_for_partner' | 'pending_confirmation' | 'querying' | 'needs_relaxation' | 'completed' | 'failed';

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** "HH:MM" 24h, interpreted in the venue's time zone (America/Los_Angeles for P0). */
export interface OpenInterval {
  opens: string;
  closes: string;
}
/** Missing weekday key = unknown for that day; empty array = closed that day. */
export type WeeklyHours = Partial<Record<Weekday, OpenInterval[]>>;

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface SearchArea {
  center: GeoPoint;
  radiusM: number;
  label: string;
}

/** A real Qloo place entity, normalized. Never constructed from model output. */
export interface Candidate {
  placeId: string;
  name: string;
  address: string | null;
  location: GeoPoint | null;
  priceLevel: PriceLevel | null;
  tagIds: string[];
  tagNames: string[];
  hours: WeeklyHours | null;
  isClosed: boolean | null;
  website: string | null;
  externalUrl: string | null;
  description: string | null;
  /** Qloo-hosted venue photo, when Qloo has one. */
  imageUrl: string | null;
}

/** What a participant's agent is allowed to hand to the coordinator. No raw history. */
export interface ParticipantView {
  key: ParticipantKey;
  profileId: string;
  profileVersion: number;
  displayName: string;
  positiveEntityIds: string[];
  /** Names for every signal id, including liked history. Coordinator-internal: never shown to the other person. */
  positiveEntityNames: string[];
  /** Only the places the person chose to list on their profile. Safe to show in shared results. */
  displayLikes: string[];
  excludedCuisines: string[];
  priceMax: PriceLevel | null;
  visitedPlaceIds: string[];
  dismissedPlaceIds: string[];
  hasUnresolvedHistory: boolean;
}

export interface TimeWindow {
  /** YYYY-MM-DD in the venue's time zone. */
  date: string;
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
}

export type Relaxation = 'expand_radius' | 'raise_price' | 'allow_revisits';

export interface Constraints {
  area: SearchArea | null;
  priceMax: PriceLevel | null;
  /** The user's original exact-budget wording, kept verbatim. Filtering only uses priceMax. */
  budgetNote: string | null;
  timeWindow: TimeWindow | null;
  /** If true, a venue with unverified hours cannot be declared as meeting all conditions. */
  requireOpen: boolean;
  occasion: Occasion | null;
  decisionMode: DecisionMode;
  excludeVisited: boolean;
  /** Relaxations the users explicitly opted into. Never applied implicitly. */
  relaxations: Relaxation[];
}

export type ExclusionReason =
  | 'outside_area'
  | 'over_budget'
  | 'excluded_cuisine'
  | 'closed_permanently'
  | 'closed_in_window'
  | 'visited'
  | 'dismissed'
  | 'rejected_this_session'
  | 'missing_score'
  | 'not_a_meal';

export interface Exclusion {
  placeId: string;
  reason: ExclusionReason;
  /** Which participant's data triggered it, when applicable. */
  participant: ParticipantKey | null;
}

export interface ParticipantScore {
  affinity: number;
  /** 0 based rank within this participant's single scoring query. */
  rank: number;
  /** Normalized rank utility in [0, 1]. Ranking heuristic only, not a satisfaction probability. */
  utility: number;
  /** How many candidates this participant's ranks were computed over. */
  poolSize: number;
}

export type HoursStatus = 'open_at_start' | 'closed_at_start' | 'unverified' | 'no_time_given';

export interface ScoredCandidate {
  candidate: Candidate;
  scores: Partial<Record<ParticipantKey, ParticipantScore>>;
  minUtility: number;
  meanUtility: number;
  distanceM: number | null;
  hoursStatus: HoursStatus;
  /** Qloo tag names matching the requested occasion (soft preference). */
  occasionTags: string[];
}

export interface VenueFact {
  field: 'address' | 'price_level' | 'hours' | 'distance' | 'cuisine' | 'website' | 'occasion';
  value: string;
  source: 'qloo' | 'computed';
}

export interface CardEvidence {
  /** Facts the users stated (their liked places, constraints). */
  userProvided: string[];
  /** Qloo recommendation signals (affinity-derived ranks). */
  qlooSignals: string[];
  /** Venue facts with their source. */
  venueFacts: VenueFact[];
}

export interface RecommendationCard {
  placeId: string;
  name: string;
  address: string | null;
  distanceM: number | null;
  priceLevel: PriceLevel | null;
  cuisines: string[];
  hoursStatus: HoursStatus;
  /** Today's/target-day hours as display text, null when unverified. */
  hoursText: string | null;
  novelty: 'new_to_everyone' | 'not_checked';
  reasons: string[];
  evidence: CardEvidence;
  links: { label: string; url: string }[];
  utilities: Partial<Record<ParticipantKey, number>>;
  /** 1-based rank and pool size per participant, from their own Qloo scoring query. */
  ranks: Partial<Record<ParticipantKey, { rank: number; of: number }>>;
  imageUrl: string | null;
  /** Qloo tag names that match the occasion, e.g. "Date night". Empty when none or no occasion. */
  occasionTags: string[];
}

/** What each person would have gotten alone from the same filtered pool. Shows why the shared pick differs. */
export interface ParticipantTopPicks {
  key: ParticipantKey;
  displayName: string;
  picks: { placeId: string; name: string; rank: number }[];
}

export interface RecommendationResult {
  status: RunStatus;
  runId: string | null;
  decisionMode: DecisionMode;
  cards: RecommendationCard[];
  /** Fields we could not verify, e.g. hours, price. English strings. */
  unknowns: string[];
  /** Conditions that need the users' confirmation before we can say they are met. */
  conditionsToConfirm: string[];
  relaxationOptions: Relaxation[];
  exclusionSummary: { reason: ExclusionReason; count: number }[];
  historyIncomplete: boolean;
  dataSources: string[];
  explanationSource: 'llm' | 'template';
  message: string | null;
  createdAt: string;
  stale: boolean;
  /** Two-person runs only: each person's own top picks over the same pool. Empty for solo runs. */
  perParticipant: ParticipantTopPicks[];
}
