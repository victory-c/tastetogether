import 'server-only';
import { AppError } from './http';

// Per-instance sliding window. Coarse on serverless, but stops one visitor from draining the
// shared Qloo quota during judging; the global hourly ceiling in qloo/client.ts is the backstop.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) throw new AppError('rate_limited');
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
}
