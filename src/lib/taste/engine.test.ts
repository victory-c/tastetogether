import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Narration, NarrationFacts, VibePlan } from '../agent/llm';
import { runMatch } from './engine';
import { DEFAULT_AREA } from './occasions';
import type { MatchEvent, MatchRequest } from './types';

// Synthetic stand-ins for Qloo and the LLM: no network, no real Qloo data.
const llm = vi.hoisted(() => ({
  on: false,
  vibe: null as VibePlan | null,
  narrate: vi.fn<(facts: NarrationFacts) => Promise<Narration | null>>(),
}));

vi.mock('../qloo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../qloo/client')>()),
  qlooGet: vi.fn(async (path: string, params: Record<string, unknown>) => fakeQloo(path, params)),
}));

vi.mock('../agent/llm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../agent/llm')>()),
  llmAvailable: () => llm.on,
  cachedNarration: () => null,
  interpretVibe: async () => llm.vibe,
  narrate: llm.narrate,
}));

const PLACES = Array.from({ length: 10 }, (_, i) => ({
  entity_id: `place-${i}`,
  name: `Place ${i}`,
  popularity: 0.5 + i / 100,
  location: { lat: 37.871, lon: -122.268 },
  tags: [],
  properties: { primary_genre: { id: 'urn:tag:genre:place:restaurant:italian' }, price_level: i % 2 === 0 ? 1 : 3 },
}));

function fakeQloo(path: string, params: Record<string, unknown>) {
  if (path === '/v2/analysis/compare') {
    return {
      results: { tags: [{ tag_id: 'urn:tag:genre:media:drama', name: 'Drama', subtype: 'urn:tag:genre:media', query: { score: 1 } }] },
    };
  }
  const scoring = params['filter.results.entities'];
  if (typeof scoring === 'string') {
    const forA = String(params['signal.interests.entities']).includes('a-1');
    return {
      results: {
        entities: scoring.split(',').map((id, i) => ({
          ...PLACES.find((p) => p.entity_id === id)!,
          query: { affinity: forA ? 0.9 - i * 0.02 : 0.6 + i * 0.02 },
        })),
      },
    };
  }
  return { results: { entities: PLACES } };
}

const REQ: MatchRequest = {
  a: { name: 'Ana', interests: [{ id: 'a-1', name: 'Artist A', kind: 'artist' }] },
  b: { name: 'Ben', interests: [{ id: 'b-1', name: 'Film B', kind: 'movie' }] },
  occasion: 'date',
  priceMax: null,
  area: DEFAULT_AREA,
  mode: 'three',
};

async function collect(req: MatchRequest = REQ) {
  const events: MatchEvent[] = [];
  // Snapshot each event: the engine may update pick copy after an event has been sent.
  for await (const e of runMatch(req)) events.push(structuredClone(e));
  return events;
}

const resultOf = (events: MatchEvent[]) => events.find((e) => e.type === 'result') as Extract<MatchEvent, { type: 'result' }>;
const narrations = (events: MatchEvent[]) => events.filter((e) => e.type === 'narration') as Extract<MatchEvent, { type: 'narration' }>[];
const explainDone = (events: MatchEvent[]) => events.find((e) => e.type === 'step' && e.id === 'explain' && e.status === 'done');

describe('runMatch explanations', () => {
  beforeEach(() => {
    llm.on = false;
    llm.vibe = null;
    llm.narrate.mockReset();
  });

  it('without an LLM key, sends template copy and finishes the explain step before the result', async () => {
    const events = await collect();
    const result = resultOf(events);
    expect(result.stats.llm).toBeNull();
    expect(result.picks.every((p) => p.why && !p.why.startsWith('LLM'))).toBe(true);
    expect(events.indexOf(explainDone(events)!)).toBeLessThan(events.indexOf(result));
    expect(narrations(events)).toHaveLength(0);
    expect(llm.narrate).not.toHaveBeenCalled();
  });

  it('with a key, sends the picks first and streams LLM copy for every pick afterwards', async () => {
    llm.on = true;
    llm.narrate.mockImplementation(async (facts) => ({
      headline: `Headline for ${facts.picks.length}`,
      picks: facts.picks.map((p) => ({ id: p.id, why: `LLM line for ${p.name}` })),
    }));
    const events = await collect();
    const result = resultOf(events);
    const written = narrations(events);

    expect(result.stats.llm).toBe('pending');
    expect(result.picks.every((p) => p.why && !p.why.startsWith('LLM'))).toBe(true);
    expect(written).toHaveLength(2);
    expect(written.every((n) => events.indexOf(n) > events.indexOf(result))).toBe(true);
    expect(written.flatMap((n) => n.whys.map((w) => w.id)).sort()).toEqual(result.picks.map((p) => p.id).sort());
    expect(written.filter((n) => n.headline)).toHaveLength(1);
    expect(written.find((n) => n.headline)!.whys.map((w) => w.id)).toEqual(result.picks.slice(0, 3).map((p) => p.id));
    expect(events.at(-1)).toMatchObject({ type: 'step', id: 'explain', status: 'done', detail: expect.stringContaining('Written by') });
  });

  it('keeps the templates when the LLM fails', async () => {
    llm.on = true;
    llm.narrate.mockRejectedValue(new Error('timeout'));
    const events = await collect();
    expect(narrations(events)).toHaveLength(0);
    expect(events.at(-1)).toMatchObject({ type: 'step', id: 'explain', status: 'done', detail: expect.stringContaining('Fact templates') });
    expect(resultOf(events).picks.every((p) => p.why)).toBe(true);
  });

  it("applies the vibe's price ceiling to places scouted before the vibe was known", async () => {
    llm.on = true;
    llm.vibe = { boost: [], avoid: [], priceMax: 1 };
    llm.narrate.mockResolvedValue(null);
    const events = await collect({ ...REQ, vibe: 'cheap and cheerful' });
    const result = resultOf(events);
    expect(result.picks.length).toBeGreaterThan(0);
    expect(result.picks.every((p) => (p.priceLevel ?? 0) <= 1)).toBe(true);
  });
});
