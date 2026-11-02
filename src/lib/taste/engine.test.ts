import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Narration, NarrationFacts, VibePlan } from '../agent/llm';
import { qlooGet } from '../qloo/client';
import { runMatch } from './engine';
import { DEFAULT_AREA } from './occasions';
import { VIBE_WEIGHT } from './rank';
import type { MatchEvent, MatchRequest } from './types';

// Synthetic stand-ins for Qloo and the LLM: no network, no real Qloo data.
const llm = vi.hoisted(() => ({
  on: false,
  vibe: null as VibePlan | null,
  narrate: vi.fn<(facts: NarrationFacts) => Promise<Narration | null>>(),
}));
// By default the two people like opposite ends of the pool; with sameTaste they agree, so the top places fit both.
const qloo = vi.hoisted(() => ({ sameTaste: false }));

vi.mock('../qloo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../qloo/client')>()),
  qlooGet: vi.fn(async (path: string, params: Record<string, unknown>) => fakeQloo(path, params)),
}));

vi.mock('../agent/llm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../agent/llm')>()),
  llmAvailable: () => llm.on,
  cachedNarration: () => null,
  interpretVibe: vi.fn(async () => llm.vibe),
  narrate: llm.narrate,
}));

const PLACES = Array.from({ length: 10 }, (_, i) => ({
  entity_id: `place-${i}`,
  name: `Place ${i}`,
  // Flat popularity, so a person's fit follows their affinity order exactly.
  popularity: 0.5,
  location: { lat: 37.871, lon: -122.268 },
  tags: [] as { id: string; name: string }[],
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
          query: { affinity: forA || qloo.sameTaste ? 0.9 - i * 0.02 : 0.6 + i * 0.02 },
        })),
      },
    };
  }
  const max = params['filter.price_level.max'];
  return { results: { entities: typeof max === 'number' ? PLACES.filter((p) => p.properties.price_level <= max) : PLACES } };
}

const REQ: MatchRequest = {
  a: { name: 'Ana', interests: [{ id: 'a-1', name: 'Artist A', kind: 'artist' }] },
  b: { name: 'Ben', interests: [{ id: 'b-1', name: 'Film B', kind: 'movie' }] },
  occasion: 'date',
  priceMax: null,
  area: DEFAULT_AREA,
  mode: 'three',
};

async function collect(req: MatchRequest = REQ, options?: { narrateSpares?: boolean }) {
  const events: MatchEvent[] = [];
  // Snapshot each event: the engine may update pick copy after an event has been sent.
  for await (const e of runMatch(req, options)) events.push(structuredClone(e));
  return events;
}

const llmLines = (facts: NarrationFacts): Narration => ({
  headline: `Headline for ${facts.picks.length}`,
  picks: facts.picks.map((p) => ({ id: p.id, why: `LLM line for ${p.name}` })),
});

const resultOf = (events: MatchEvent[]) => events.find((e) => e.type === 'result') as Extract<MatchEvent, { type: 'result' }>;
const narrations = (events: MatchEvent[]) => events.filter((e) => e.type === 'narration') as Extract<MatchEvent, { type: 'narration' }>[];
const explainDone = (events: MatchEvent[]) => events.find((e) => e.type === 'step' && e.id === 'explain' && e.status === 'done');

describe('runMatch explanations', () => {
  beforeEach(() => {
    llm.on = false;
    llm.vibe = null;
    llm.narrate.mockReset();
    vi.mocked(qlooGet).mockClear();
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
    llm.narrate.mockImplementation(async (facts) => llmLines(facts));
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

  it('sends the on-screen copy first even when the spares finish first', async () => {
    llm.on = true;
    let call = 0;
    llm.narrate.mockImplementation(async (facts) => {
      const first = call++ === 0;
      if (first) await new Promise((r) => setTimeout(r, 30));
      return llmLines(facts);
    });
    const events = await collect();
    const written = narrations(events);
    expect(written).toHaveLength(2);
    expect(written[0]!.headline).toBeDefined();
    expect(written[0]!.whys.map((w) => w.id)).toEqual(
      resultOf(events)
        .picks.slice(0, 3)
        .map((p) => p.id),
    );
  });

  it('says templates when only the off-screen spares were written', async () => {
    llm.on = true;
    let call = 0;
    llm.narrate.mockImplementation(async (facts) => {
      if (call++ === 0) throw new Error('timeout');
      return llmLines(facts);
    });
    const events = await collect();
    expect(narrations(events)).toHaveLength(1);
    expect(narrations(events)[0]!.headline).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'step', id: 'explain', status: 'done', detail: expect.stringContaining('Fact templates') });
  });

  it('can skip LLM copy for the spares', async () => {
    llm.on = true;
    llm.narrate.mockImplementation(async (facts) => llmLines(facts));
    const events = await collect(REQ, { narrateSpares: false });
    expect(llm.narrate).toHaveBeenCalledTimes(1);
    expect(llm.narrate.mock.calls[0]![0].picks).toHaveLength(3);
    expect(narrations(events)).toHaveLength(1);
  });

  it("scouts again with the vibe's lower price ceiling", async () => {
    llm.on = true;
    llm.vibe = { boost: [], avoid: [], priceMax: 1 };
    llm.narrate.mockResolvedValue(null);
    const events = await collect({ ...REQ, vibe: 'cheap and cheerful' });
    const result = resultOf(events);
    const scoutedAtOne = vi
      .mocked(qlooGet)
      .mock.calls.some(([, params]) => params?.['filter.price_level.max'] === 1 && !params['filter.results.entities']);
    expect(scoutedAtOne).toBe(true);
    expect(result.picks.length).toBeGreaterThan(0);
    expect(result.picks.every((p) => (p.priceLevel ?? 0) <= 1)).toBe(true);
  });
});

describe('runMatch vibe ranking', () => {
  const quiet: VibePlan = { boost: [{ id: 'urn:tag:noise_level:qloo:quiet', name: 'Quiet', concept: 'quiet' }], avoid: [], priceMax: null };
  const tag = (index: number, name: string) => PLACES[index]!.tags.push({ id: `tag-${name}`, name });

  beforeEach(() => {
    llm.on = false;
    llm.vibe = null;
    qloo.sameTaste = true;
    PLACES.forEach((p) => (p.tags = []));
  });

  afterEach(() => {
    qloo.sameTaste = false;
    PLACES.forEach((p) => (p.tags = []));
  });

  it('lifts a good fit that matches the vibe, even when the occasion already likes that tag', async () => {
    tag(3, 'Quiet');
    expect(resultOf(await collect()).picks[0]!.id).toBe('place-0');

    llm.vibe = quiet;
    const result = resultOf(await collect({ ...REQ, vibe: 'quiet' }));
    expect(result.picks[0]).toMatchObject({ id: 'place-3', matchedVibe: ['Quiet'] });
    expect(result.relaxed).toBeUndefined();
  });

  it('does not lift a place that is a poor fit, and says the vibe went unmatched', async () => {
    // place-5 sits just above the 0.4 gate: an ungated lift would carry it into the top three.
    tag(5, 'Quiet');
    llm.vibe = quiet;
    const result = resultOf(await collect({ ...REQ, vibe: 'quiet' }));
    expect(result.picks.slice(0, 3).map((p) => p.id)).toEqual(['place-0', 'place-1', 'place-2']);
    expect(result.relaxed).toBe('No place tagged Quiet made your top three; these are the best fits for both of you.');
  });

  it('adds the vibe lift once, apart from the occasion bonus', async () => {
    tag(0, 'Outdoor seating'); // not a date-night boost tag
    const fairOf = async (vibe?: string) =>
      resultOf(await collect(vibe ? { ...REQ, vibe } : REQ)).picks.find((p) => p.id === 'place-0')!.fair;
    const before = await fairOf();
    llm.vibe = { boost: [{ id: 'o', name: 'Outdoor seating', concept: 'outdoor' }], avoid: [], priceMax: null };
    expect((await fairOf('outdoor seating')) - before).toBeCloseTo(VIBE_WEIGHT, 6);
  });

  it('names the part of the vibe that no on-screen pick has', async () => {
    [0, 1, 2].forEach((i) => tag(i, 'Vegetarian'));
    tag(8, 'Quiet');
    llm.vibe = { ...quiet, boost: [...quiet.boost, { id: 'v', name: 'Vegetarian', concept: 'vegetarian' }] };
    const result = resultOf(await collect({ ...REQ, vibe: 'quiet, vegetarian' }));
    expect(result.relaxed).toBe('No place tagged Quiet made your top three; these are the best fits for both of you.');
  });

  it('says when no scored place has the tag at all', async () => {
    llm.vibe = quiet;
    const result = resultOf(await collect({ ...REQ, vibe: 'quiet' }));
    expect(result.relaxed).toBe('None of the 10 spots we scored is tagged Quiet; these are the best fits for both of you.');
  });

  it('checks only the on-screen picks: a match at #3 is off screen in mode one', async () => {
    tag(4, 'Quiet');
    llm.vibe = quiet;
    const result = resultOf(await collect({ ...REQ, vibe: 'quiet', mode: 'one' }));
    expect(result.picks.slice(0, 3).map((p) => p.id)).toEqual(['place-0', 'place-1', 'place-4']);
    expect(result.relaxed).toBe('No place tagged Quiet made your top pick; this is the best fit for both of you.');
  });

  it('scores synonyms from one search as a single ask', async () => {
    // place-1 fits better but only has the two vegetarian synonyms; place-2 answers both asks, so it wins.
    // Counting tags instead of asks would score them 2 of 3 each and keep place-1 ahead.
    tag(1, 'Vegetarian');
    tag(1, 'Vegetarian meals');
    tag(2, 'Vegetarian');
    tag(2, 'Outdoor seating');
    llm.vibe = {
      boost: [
        { id: 'v1', name: 'Vegetarian', concept: 'vegetarian' },
        { id: 'v2', name: 'Vegetarian meals', concept: 'vegetarian' },
        { id: 'o', name: 'Outdoor seating', concept: 'outdoor' },
      ],
      avoid: [],
      priceMax: null,
    };
    const ids = resultOf(await collect({ ...REQ, vibe: 'vegetarian, outdoor seating' })).picks.map((p) => p.id);
    expect(ids.indexOf('place-2')).toBeLessThan(ids.indexOf('place-1'));
  });
});

describe('runMatch availability and data hygiene', () => {
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const closedAllWeek = Object.fromEntries(DAYS.map((d) => [d, [{ closed: true }]]));
  type Props = (typeof PLACES)[number]['properties'] & { hours?: unknown; specialty_dishes?: { name: string }[] };
  const props = (i: number) => PLACES[i]!.properties as Props;

  beforeEach(() => {
    llm.on = false;
    llm.vibe = null;
    qloo.sameTaste = true;
  });
  afterEach(() => {
    qloo.sameTaste = false;
    PLACES.forEach((p) => {
      delete (p.properties as Props).hours;
      delete (p.properties as Props).specialty_dishes;
    });
  });

  it('holds back places closed at the plan time when enough open places exist, and says so', async () => {
    props(0).hours = closedAllWeek;
    props(1).hours = closedAllWeek;
    const result = resultOf(await collect());
    expect(result.picks.slice(0, 3).map((p) => p.id)).toEqual(['place-2', 'place-3', 'place-4']);
    expect(result.picks.slice(0, 3).every((p) => p.open.kind !== 'closed_today')).toBe(true);
    expect(result.relaxed).toMatch(/Held back 2 places that aren’t open/);
    // Taste ranks are untouched: place-2 is still #3 for Ana, not renumbered.
    expect(result.picks[0]!.fitA.rank).toBe(3);
  });

  it('still shows closed places when there are not enough open ones, without claiming otherwise', async () => {
    PLACES.forEach((_, i) => (props(i).hours = closedAllWeek));
    const result = resultOf(await collect());
    expect(result.picks[0]!.id).toBe('place-0');
    expect(result.relaxed).toBeUndefined();
  });

  it('falls back to keyword matching when the vibe agent exceeds its time budget', async () => {
    llm.on = true;
    llm.vibe = { boost: [{ id: 'urn:tag:ambience:qloo:cozy', name: 'Cozy', concept: 'cozy' }], avoid: [], priceMax: null };
    const { interpretVibe } = await import('../agent/llm');
    vi.mocked(interpretVibe).mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(llm.vibe), 150)));
    const events: MatchEvent[] = [];
    for await (const e of runMatch({ ...REQ, vibe: 'quiet' }, { vibeBudgetMs: 10 })) events.push(structuredClone(e));
    const vibe = events.find((e) => e.type === 'vibe') as Extract<MatchEvent, { type: 'vibe' }>;
    expect(vibe.source).toBe('keywords');
    expect(vibe.tags.map((t) => t.name)).toEqual(['Quiet']);
    const step = events.find((e) => e.type === 'step' && e.id === 'vibe' && e.status === 'done') as Extract<MatchEvent, { type: 'step' }>;
    expect(step.detail).toMatch(/keyword match/);
  });

  it('drops dish-name fragments such as "And Fries"', async () => {
    props(0).specialty_dishes = [{ name: 'Confit Duck Wings' }, { name: 'And Fries' }, { name: 'Shrimp Toast' }];
    const result = resultOf(await collect());
    expect(result.picks[0]!.dishes).toEqual(['Confit Duck Wings', 'Shrimp Toast']);
  });
});

describe('runMatch narration grounding', () => {
  beforeEach(() => {
    llm.on = true;
    llm.vibe = null;
    qloo.sameTaste = true;
  });
  afterEach(() => {
    llm.on = false;
    qloo.sameTaste = false;
    llm.narrate.mockReset();
  });

  it('drops model lines that claim facts the model was never given, and says so in the trace', async () => {
    llm.narrate.mockImplementation(async (facts) => ({
      headline: 'h',
      picks: facts.picks.map((p, i) => ({ id: p.id, why: i === 0 ? 'Dinner runs about $40 a head here.' : `Grounded line for ${p.name}` })),
    }));
    const events = await collect(REQ, { narrateSpares: false });
    const sent = narrations(events).flatMap((n) => n.whys);
    expect(sent.some((w) => /\$40/.test(w.why))).toBe(false);
    expect(sent.length).toBeGreaterThan(0);
    const result = resultOf(events);
    expect(result.picks[0]!.why).not.toMatch(/\$40/);
  });

  it('keeps templates and reports a facts-check failure when every line is ungrounded', async () => {
    llm.narrate.mockImplementation(async (facts) => ({
      headline: 'h',
      picks: facts.picks.map((p) => ({ id: p.id, why: 'Open until 11 pm with no wait.' })),
    }));
    const events = await collect(REQ, { narrateSpares: false });
    expect(narrations(events)).toHaveLength(0);
    expect((explainDone(events) as Extract<MatchEvent, { type: 'step' }> | undefined)?.detail).toMatch(/facts check/);
  });
});
