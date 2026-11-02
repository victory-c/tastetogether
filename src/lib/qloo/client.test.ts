import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { qlooGet } from './client';

const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('qlooGet guards', () => {
  beforeEach(() => vi.stubEnv('QLOO_API_KEY', 'test-key'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('starts no request once the run deadline has passed', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(qlooGet('/v2/tags', { 'filter.query': 'x1' }, { calls: 0, cached: 0, deadline: Date.now() - 1 })).rejects.toThrow(
      /took too long/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps at most six Qloo requests in flight', async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 20));
        active -= 1;
        return okJson({ results: { entities: [] } });
      }),
    );
    await Promise.all(Array.from({ length: 15 }, (_, i) => qlooGet('/v2/insights', { probe: i })));
    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBeGreaterThan(1);
  });
});
