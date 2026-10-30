import 'server-only';

import type { QlooEntity, QlooInsightsResponse } from './types';

const DEFAULT_BASE = 'https://hackathon.api.qloo.com';
const TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'QlooError';
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

// Private, in-memory server cache. Qloo allows server-side caching; nothing is persisted to disk or the repo.
const cache = new Map<string, { at: number; value: unknown }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

export function isQlooConfigured() {
  return Boolean(process.env.QLOO_API_KEY);
}

export interface CallStats {
  calls: number;
  cached: number;
}

export async function qlooGet<T>(path: string, params: Params, stats?: CallStats): Promise<T> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new QlooError('Qloo is not configured on this server.', null);
  const base = process.env.QLOO_API_URL || DEFAULT_BASE;

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const url = `${base}${path}?${qs.toString()}`;

  const cached = cacheGet<T>(url);
  if (cached !== undefined) {
    if (stats) stats.cached += 1;
    return cached;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'X-Api-Key': key, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
      if (stats) stats.calls += 1;
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      if (!res.ok) throw new QlooError(`Qloo responded with ${res.status}.`, res.status);
      const json = (await res.json()) as T;
      cacheSet(url, json);
      return json;
    } catch (err) {
      lastError = err;
      if (err instanceof QlooError && err.status !== null && err.status < 500) break;
    }
  }
  if (lastError instanceof QlooError) throw lastError;
  throw new QlooError('Qloo could not be reached.', null);
}

export function entitiesOf(body: QlooInsightsResponse | undefined): QlooEntity[] {
  const results = body?.results;
  if (!results) return [];
  if (Array.isArray(results)) return results as QlooEntity[];
  return results.entities ?? [];
}
