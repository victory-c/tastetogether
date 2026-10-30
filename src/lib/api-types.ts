// HTTP contract between the UI (L5) and API routes (L4). Safe to import from client components:
// it only re-exports domain types and declares DTOs. Never import src/server/** from the UI.

import type {
  Constraints,
  DecisionMode,
  MemoryStatus,
  Occasion,
  ParticipantKey,
  PriceLevel,
  Rating,
  RecommendationResult,
  Relaxation,
  SessionState,
} from '@/domain/types';

export type {
  Constraints,
  DecisionMode,
  MemoryStatus,
  Occasion,
  ParticipantKey,
  PriceLevel,
  Rating,
  RecommendationResult,
  Relaxation,
  SessionState,
};
export type { RecommendationCard, HoursStatus, ExclusionReason, RunStatus } from '@/domain/types';

/** Error body for every non-2xx response. `message` is user-safe English. */
export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}
export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'conflict'
  | 'profile_required'
  | 'session_expired'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'internal';

export interface EntityRef {
  id: string;
  name: string;
  address: string | null;
}

export interface AreaInput {
  label: string;
  lat: number;
  lon: number;
  radiusM: number;
}

// ---- Profile: GET/POST/PATCH /api/profile (always the caller's own profile) ----

export interface ProfileDTO {
  id: string;
  displayName: string;
  area: AreaInput;
  priceMax: PriceLevel | null;
  excludedCuisines: string[];
  positiveEntities: EntityRef[];
  isDemo: boolean;
  version: number;
}

export interface ProfileInput {
  displayName: string;
  area: AreaInput;
  priceMax: PriceLevel | null;
  excludedCuisines: string[];
  /** Must be confirmed Qloo entities (picked from /api/places/search). At least 3 before recommending. */
  positiveEntities: EntityRef[];
}
export type ProfileResponse = { profile: ProfileDTO | null };

// ---- Dining memory: GET/POST /api/memories, PATCH/DELETE /api/memories/:id ----

export interface MemoryDTO {
  id: string;
  /** null = unresolved: no confirmed Qloo entity yet. Never a guessed id. */
  placeId: string | null;
  name: string;
  address: string | null;
  status: MemoryStatus;
  visitDate: string | null;
  visitCount: number | null;
  rating: Rating | null;
  revisitIntent: boolean | null;
  source: 'manual' | 'feedback' | 'demo';
  createdAt: string;
  updatedAt: string;
}

export interface MemoryInput {
  placeId: string | null;
  name: string;
  address: string | null;
  status: MemoryStatus;
  visitDate?: string | null;
  visitCount?: number | null;
  rating?: Rating | null;
  revisitIntent?: boolean | null;
}
export type MemoryPatch = Partial<MemoryInput>;
export type MemoriesResponse = { memories: MemoryDTO[] };
export type MemoryResponse = { memory: MemoryDTO };

// ---- Place search: GET /api/places/search?q=... ----

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string | null;
}
export type PlaceSearchResponse = { results: PlaceSearchResult[] };

// ---- Sessions (rooms) ----

export interface ParticipantSummary {
  key: ParticipantKey;
  displayName: string;
  joined: boolean;
  confirmed: boolean;
  isYou: boolean;
}

export interface SessionDTO {
  id: string;
  state: SessionState;
  /** The caller's seat. Demo sessions: the visitor drives both sample seats as 'A'. */
  you: ParticipantKey;
  isDemo: boolean;
  participants: ParticipantSummary[];
  constraints: Constraints;
  version: number;
  expiresAt: string;
  /** Only returned to the creator, only on create or invite rotation. */
  inviteUrl: string | null;
  rejectedCount: number;
  latestResult: RecommendationResult | null;
}

/** POST /api/sessions */
export interface CreateSessionInput {
  constraints: Constraints;
}
/** POST /api/sessions/:id/join */
export interface JoinSessionInput {
  token: string;
  consent: true;
}
/** PATCH /api/sessions/:id/constraints. expectedVersion guards concurrent edits (409 on mismatch). */
export interface UpdateConstraintsInput {
  constraints: Constraints;
  expectedVersion: number;
}
/** POST /api/sessions/:id/reject — "Try another": excluded for this session only. */
export interface RejectInput {
  placeId: string;
  reason?: string | null;
}
export type SessionResponse = { session: SessionDTO };

// ---- Recommendations: POST /api/recommendations ----

export interface RecommendInput {
  /** null = solo run using the caller's own profile. */
  sessionId: string | null;
  /** Client-generated UUID per user action; retries with the same key return the same run. */
  idempotencyKey: string;
  /** Solo runs only. Session runs always use the session's confirmed constraints. */
  constraints?: Constraints;
}
export type RecommendResponse = { result: RecommendationResult };

// ---- Feedback: POST /api/feedback ----

export interface FeedbackInput {
  runId: string;
  placeId: string;
  kind: 'selected' | 'visited';
  rating?: Rating | null;
  revisitIntent?: boolean | null;
}
export type FeedbackResponse = { ok: true };

// ---- Demo: POST /api/demo { action } ----

export interface DemoInput {
  action: 'load' | 'reset';
}
export type DemoResponse = { sessionId: string | null };
