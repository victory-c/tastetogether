import 'server-only';
import type { Candidate, GeoPoint, PriceLevel } from '@/domain/types';
import { mapEntity } from './map';
import { insightsResponseSchema, parseEntities, QlooError, searchResponseSchema } from './types';

const TIMEOUT_MS = 8_000;
const RESTAURANT_TAG = 'urn:tag:genre:place:restaurant';
/** Qloo caps take at 50. The scoring pool is capped to this so each participant's scores come from one query. */
export const MAX_SCORE_POOL = 50;

export interface QlooRequestRef {
  endpoint: 'search' | 'insights';
  purpose: string;
  status: number | 'timeout' | 'error';
  ms: number;
  resultCount: number;
}

/** Per-run call budget so a public demo can't drain the quota through one request. */
export class QlooBudget {
  readonly refs: QlooRequestRef[] = [];
  constructor(private remaining: number) {}
  take(): void {
    if (this.remaining <= 0) throw new QlooError('budget_exhausted', 'Qloo call budget exhausted for this run');
    this.remaining -= 1;
  }
}

// Process-wide ceiling, reset hourly. Coarse, but bounds damage from a public URL.
const GLOBAL_LIMIT_PER_HOUR = Number(process.env.QLOO_MAX_CALLS_PER_HOUR ?? 600);
let windowStart = Date.now();
let windowCalls = 0;
function takeGlobal(): void {
  if (Date.now() - windowStart > 3_600_000) {
    windowStart = Date.now();
    windowCalls = 0;
  }
  if (windowCalls >= GLOBAL_LIMIT_PER_HOUR) throw new QlooError('budget_exhausted', 'Hourly Qloo call limit reached');
  windowCalls += 1;
}

function config(): { baseUrl: string; key: string } {
  const key = process.env.QLOO_API_KEY;
  const baseUrl = process.env.QLOO_API_URL ?? 'https://hackathon.api.qloo.com';
  if (!key) throw new QlooError('not_configured', 'QLOO_API_KEY is not set');
  return { baseUrl: baseUrl.replace(/\/$/, ''), key };
}

async function get(path: string, params: Record<string, string>, budget: QlooBudget, purpose: string): Promise<unknown> {
  const { baseUrl, key } = config();
  const url = `${baseUrl}${path}?${new URLSearchParams(params).toString()}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    budget.take();
    takeGlobal();
    const started = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'X-Api-Key': key, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
      const ref: QlooRequestRef = {
        endpoint: path.includes('insights') ? 'insights' : 'search',
        purpose,
        status: res.status,
        ms: Date.now() - started,
        resultCount: 0,
      };
      budget.refs.push(ref);
      if (res.status >= 500 || res.status === 429) {
        lastError = new QlooError('http', `Qloo HTTP ${res.status}`, res.status);
        continue;
      }
      if (!res.ok) throw new QlooError('http', `Qloo HTTP ${res.status}`, res.status);
      const body: unknown = await res.json();
      return Object.assign(body as object, { __ref: ref });
    } catch (err) {
      if (err instanceof QlooError && err.kind !== 'http') throw err;
      if (err instanceof QlooError && err.httpStatus && err.httpStatus < 500 && err.httpStatus !== 429) throw err;
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      if (!(err instanceof QlooError))
        budget.refs.push({
          endpoint: path.includes('insights') ? 'insights' : 'search',
          purpose,
          status: timedOut ? 'timeout' : 'error',
          ms: Date.now() - started,
          resultCount: 0,
        });
      lastError = timedOut ? new QlooError('timeout', 'Qloo request timed out') : err;
    }
  }
  throw lastError instanceof QlooError ? lastError : new QlooError('http', 'Qloo request failed');
}

function setCount(body: unknown, n: number): void {
  const ref = (body as { __ref?: QlooRequestRef }).__ref;
  if (ref) ref.resultCount = n;
}

/** Entity search for resolving a user's typed restaurant name. Results are suggestions; the user must confirm. */
export async function searchPlaces(query: string, budget: QlooBudget, near?: GeoPoint): Promise<Candidate[]> {
  const params: Record<string, string> = { query, types: 'urn:entity:place', take: '8' };
  if (near) {
    // /search wants "lat,lon" (unlike insights, which takes WKT).
    params['filter.location'] = `${near.lat},${near.lon}`;
    params['filter.radius'] = '25';
  }
  const body = await get('/search', params, budget, 'entity_search');
  const parsed = searchResponseSchema.safeParse(body);
  if (!parsed.success) throw new QlooError('bad_response', 'Unexpected search response shape');
  const entities = parseEntities(parsed.data.results);
  setCount(body, entities.length);
  return entities.map(mapEntity);
}

export interface DiscoverParams {
  signalEntityIds: string[];
  center: GeoPoint;
  radiusM: number;
  priceMax: PriceLevel | null;
  take: number;
}

export interface ScoredEntity {
  candidate: Candidate;
  affinity: number | null;
}

function insightsBase(signalEntityIds: string[]): Record<string, string> {
  return {
    'filter.type': 'urn:entity:place',
    'filter.tags': RESTAURANT_TAG,
    'signal.interests.entities': signalEntityIds.join(','),
  };
}

async function insights(params: Record<string, string>, budget: QlooBudget, purpose: string): Promise<ScoredEntity[]> {
  const body = await get('/v2/insights', params, budget, purpose);
  const parsed = insightsResponseSchema.safeParse(body);
  if (!parsed.success) throw new QlooError('bad_response', 'Unexpected insights response shape');
  const entities = parseEntities(parsed.data.results.entities);
  setCount(body, entities.length);
  return entities.map((e) => ({ candidate: mapEntity(e), affinity: e.query?.affinity ?? null }));
}

/** Candidate discovery from one participant's own interest signals, inside the area. */
export function discover(p: DiscoverParams, budget: QlooBudget, purpose: string): Promise<ScoredEntity[]> {
  // filter.location.query mis-resolves "Berkeley, CA"; always use a WKT point + radius.
  const params: Record<string, string> = {
    ...insightsBase(p.signalEntityIds),
    'filter.location': `POINT(${p.center.lon} ${p.center.lat})`,
    'filter.location.radius': String(Math.round(p.radiusM)),
    take: String(p.take),
  };
  if (p.priceMax !== null) params['filter.price_level.max'] = String(p.priceMax);
  return insights(params, budget, purpose);
}

/**
 * Score a fixed candidate set against one participant's signals in ONE query, so every
 * affinity for this participant is comparable. Callers must cap the pool at MAX_SCORE_POOL.
 */
export async function scoreCandidates(
  signalEntityIds: string[],
  placeIds: string[],
  budget: QlooBudget,
  purpose: string,
): Promise<Map<string, number>> {
  if (placeIds.length > MAX_SCORE_POOL) throw new Error(`scoring pool exceeds ${MAX_SCORE_POOL}`);
  const out = new Map<string, number>();
  if (placeIds.length === 0) return out;
  const wanted = new Set(placeIds);
  const rows = await insights(
    { ...insightsBase(signalEntityIds), 'filter.results.entities': placeIds.join(','), take: String(placeIds.length) },
    budget,
    purpose,
  );
  for (const r of rows) if (r.affinity !== null && wanted.has(r.candidate.placeId)) out.set(r.candidate.placeId, r.affinity);
  return out;
}
