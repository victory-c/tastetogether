import 'server-only';

// Best-effort per-instance limiter to keep a public demo from draining the Qloo and LLM quotas.
const buckets = new Map<string, { count: number; reset: number }>();

function clientKey(request: Request) {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anon';
}

export function allow(request: Request, scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${clientKey(request)}`;
  const nowMs = Date.now();
  const hit = buckets.get(key);
  if (!hit || hit.reset < nowMs) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { count: 1, reset: nowMs + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}

let day = '';
let dayCount = 0;

/** Global daily ceiling on full match runs per instance. */
export function underDailyBudget(max = Number(process.env.TASTE_DAILY_RUN_CAP || 2000)) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  dayCount += 1;
  return dayCount <= max;
}
