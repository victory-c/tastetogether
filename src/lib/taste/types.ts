export type InterestKind = 'artist' | 'movie' | 'tv_show' | 'book' | 'podcast' | 'video_game';

export interface Interest {
  id: string;
  name: string;
  kind: InterestKind;
  image?: string;
  year?: number;
}

export interface Person {
  name: string;
  interests: Interest[];
  /** Qloo place ids this person has already been to. */
  visited?: string[];
  /** Display names for places this person has been to (sample duos and memory). */
  beenTo?: { id: string; name: string }[];
}

export type Occasion = 'date' | 'friends' | 'business' | 'coffee' | 'show';
export type DecisionMode = 'three' | 'one';

export interface Area {
  id: string;
  label: string;
  lat: number;
  lon: number;
  radius: number;
}

export interface MatchRequest {
  a: Person;
  b: Person;
  occasion: Occasion;
  priceMax: 1 | 2 | 3 | 4 | null;
  area: Area;
  mode: DecisionMode;
  vibe?: string;
  /** Places rejected in this session via "Try another". */
  exclude?: string[];
  /** "Before a show": the venue is the meeting point and doors time sets the dinner window. */
  show?: { venueId: string; venueLabel: string; doors: number; performer?: Interest };
}

export interface TasteTag {
  id: string;
  name: string;
  score?: number;
}

export interface TasteDna {
  shared: TasteTag[];
  a: TasteTag[];
  b: TasteTag[];
}

export interface Driver {
  name: string;
  kind: InterestKind;
  share: number;
}

export interface PersonFit {
  /** 1-based rank of this place among the scored pool for this person. */
  rank: number;
  of: number;
  /** 0-1 heuristic fit used for ordering (not a probability). */
  fit: number;
  drivers: Driver[];
}

export type OpenStatus =
  | { kind: 'open'; until: string }
  | { kind: 'opens_later'; at: string }
  | { kind: 'closed_by_then' }
  | { kind: 'closed_today' }
  | { kind: 'unknown' };

export interface Pick {
  id: string;
  name: string;
  image?: string;
  address?: string;
  cuisine?: string;
  priceLevel?: number | null;
  rating?: number | null;
  distanceM?: number;
  open: OpenStatus;
  description?: string;
  dishes: string[];
  occasionTags: string[];
  vibeTags: string[];
  noise?: string;
  matchedVibe: string[];
  website?: string;
  mapsUrl: string;
  fair: number;
  fitA: PersonFit;
  fitB: PersonFit;
  why?: string;
}

export interface StepEvent {
  type: 'step';
  id: string;
  label: string;
  status: 'running' | 'done' | 'skipped';
  detail?: string;
  ms?: number;
}

export type MatchEvent =
  | StepEvent
  | { type: 'dna'; dna: TasteDna }
  | { type: 'vibe'; tags: TasteTag[]; source: 'agent' | 'keywords' }
  | { type: 'pool'; scored: number; popularBaseline: string[]; skipped: number }
  | {
      type: 'contrast';
      popular: string[];
      aloneA: string[];
      aloneB: string[];
      together: string[];
    }
  | {
      type: 'negotiation';
      rows: { name: string; rankA: number; rankB: number; of: number }[];
    }
  | {
      type: 'result';
      picks: Pick[];
      headline?: string;
      stats: { qlooCalls: number; cached: number; ms: number; llm: string | null };
      relaxed?: string;
      when: string;
    }
  | {
      type: 'error';
      status: 'no_match' | 'provider_unavailable' | 'needs_clarification';
      message: string;
    };
