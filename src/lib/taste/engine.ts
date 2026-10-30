import 'server-only';

import { interpretVibe, keywordVibe, llmAvailable, LLM_MODEL, narrate } from '../agent/llm';
import { entitiesOf, qlooGet, QlooError, type CallStats } from '../qloo/client';
import type { QlooCompareResponse, QlooCompareTag, QlooEntity, QlooInsightsResponse } from '../qloo/types';
import { dinnerBeforeDoors, openStatus, planTime } from './hours';
import { OCCASIONS } from './occasions';
import { rankDuo, type PoolItem } from './rank';
import type { Driver, MatchEvent, MatchRequest, Person, PersonFit, Pick, TasteDna, TasteTag } from './types';

const RESTAURANT_TAG = 'urn:tag:genre:place:restaurant';
const POOL_CAP = 50;
const RESULT_COUNT = 6;

const DNA_SUBTYPES = ['genre', 'style', 'theme', 'audience', 'characteristic', 'mood', 'subgenre', 'keyword'];
const DNA_BLOCK = ['not_for_display', 'award', 'list', 'source', 'country', 'platform', 'language', 'rating', 'release'];

function cleanDnaTags(tags: QlooCompareTag[] | undefined, by: 'score' | 'count', limit: number, skip = new Set<string>()): TasteTag[] {
  const out: TasteTag[] = [];
  const names = new Set<string>();
  const sorted = [...(tags ?? [])].sort((x, y) =>
    by === 'score'
      ? (y.query?.score ?? 0) - (x.query?.score ?? 0)
      : Number(y.query?.count ?? 0) - Number(x.query?.count ?? 0) || (y.popularity ?? 0) - (x.popularity ?? 0),
  );
  for (const t of sorted) {
    const sub = t.subtype || t.tag_id || '';
    const key = t.name.toLowerCase();
    if (!DNA_SUBTYPES.some((s) => sub.includes(s)) || DNA_BLOCK.some((b) => sub.includes(b))) continue;
    if (/\d/.test(t.name) || t.name.length > 28 || names.has(key) || skip.has(key)) continue;
    names.add(key);
    out.push({ id: t.tag_id, name: t.name, score: t.query?.score });
    if (out.length >= limit) break;
  }
  return out;
}

function genreLabel(e: QlooEntity): string | undefined {
  const id = e.properties?.primary_genre?.id ?? '';
  const last = id.split(':').pop() ?? '';
  if (last && last !== 'restaurant') {
    return last
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  const cuisine = e.tags?.find((t) => (t.type || '').includes('cuisine'));
  return cuisine?.name ?? 'Restaurant';
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function tagNames(e: QlooEntity): Set<string> {
  const s = new Set<string>();
  for (const t of e.tags ?? []) s.add(t.name.toLowerCase());
  for (const t of e.properties?.good_for ?? []) s.add(t.name.toLowerCase());
  return s;
}

function shares(e: QlooEntity | undefined): Map<string, number> {
  const raw = e?.query?.explainability?.['signal.interests.entities'] ?? [];
  const total = raw.reduce((sum, r) => sum + r.score, 0) || 1;
  return new Map(raw.map((r) => [r.entity_id, r.score / total]));
}

/** Average share of each input interest across the whole pool, so we can say which interest is *unusually* responsible for a pick. */
function baselineShares(scored: (QlooEntity | undefined)[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const e of scored) for (const [id, v] of shares(e)) sums.set(id, (sums.get(id) ?? 0) + v);
  return new Map([...sums].map(([id, v]) => [id, v / Math.max(scored.length, 1)]));
}

/**
 * Names the favorites that are *unusually* responsible for a pick. With several inputs Qloo's shares are often
 * near-uniform; in that case we return nothing and the UI says "broad match" instead of overclaiming.
 */
function drivers(e: QlooEntity | undefined, person: Person, base: Map<string, number>): Driver[] {
  const n = Math.max(person.interests.length, 1);
  return [...shares(e)]
    .map(([id, share]) => {
      const interest = person.interests.find((i) => i.id === id);
      return interest ? { name: interest.name, kind: interest.kind, share, lift: share - (base.get(id) ?? share) } : null;
    })
    .filter((d): d is Driver & { lift: number } => d !== null)
    .filter((d) => d.lift >= 0.012 || d.share >= 1 / n + 0.05)
    .sort((x, y) => y.lift - x.lift)
    .slice(0, 3)
    .map((d) => ({ name: d.name, kind: d.kind, share: d.share }));
}

/** Closed at the planned time is a strong penalty; opening later the same day (e.g. dinner-only for a lunch plan) nearly as strong. */
function availabilityPenalty(kind: Pick['open']['kind']) {
  if (kind === 'closed_today' || kind === 'closed_by_then') return 1;
  if (kind === 'opens_later') return 0.8;
  return 0;
}

/** For "Before a show" the performer is a shared taste signal for both people and the venue is the meeting point. */
function withShow(req: MatchRequest): MatchRequest {
  if (req.occasion !== 'show' || !req.show) return req;
  const perf = req.show.performer;
  const add = (p: Person): Person => (perf && !p.interests.some((i) => i.id === perf.id) ? { ...p, interests: [...p.interests, perf] } : p);
  return { ...req, a: add(req.a), b: add(req.b) };
}

function signalOf(p: Person) {
  return p.interests.map((i) => i.id).join(',');
}

function now() {
  return performance.now();
}

/**
 * The TasteTogether agent run. Each yielded event is a real step of the pipeline; the UI renders them as they arrive.
 */
export async function* runMatch(input: MatchRequest): AsyncGenerator<MatchEvent> {
  const t0 = now();
  const stats: CallStats = { calls: 0, cached: 0 };
  const req = withShow(input);
  const occ = OCCASIONS[req.occasion];
  const when = planTime(req.occasion, new Date(), req.show ? dinnerBeforeDoors(req.show.doors) : undefined);

  if (req.a.interests.length === 0 || req.b.interests.length === 0) {
    yield { type: 'error', status: 'needs_clarification', message: 'Each person needs at least one thing they love.' };
    return;
  }

  try {
    // 1. Shared taste DNA + optional vibe interpretation run in parallel with candidate scouting.
    yield { type: 'step', id: 'dna', label: `Mapping where ${req.a.name} and ${req.b.name}'s tastes overlap`, status: 'running' };
    const tDna = now();
    const dnaPromise = qlooGet<QlooCompareResponse>(
      '/v2/analysis/compare',
      { 'a.signal.interests.entities': signalOf(input.a), 'b.signal.interests.entities': signalOf(input.b) },
      stats,
    );

    const vibeText = req.vibe?.trim();
    let vibeTags: TasteTag[] = [];
    let avoidTags: TasteTag[] = [];
    let priceMax = req.priceMax;
    const vibePromise = vibeText ? interpretVibe(vibeText, req.occasion, stats).catch(() => null) : Promise.resolve(null);

    const visited = new Set([...(req.a.visited ?? []), ...(req.b.visited ?? [])]);
    const exclude = [...new Set([...visited, ...(req.exclude ?? [])])];

    const scout = (radius: number, price: number | null) => {
      const base = {
        'filter.type': 'urn:entity:place',
        'filter.location': `POINT(${req.area.lon} ${req.area.lat})`,
        'filter.location.radius': radius,
        'filter.tags': RESTAURANT_TAG,
        'filter.price_level.max': price ?? undefined,
        'filter.exclude.entities': exclude.length ? exclude.join(',') : undefined,
        take: 50,
      };
      return Promise.all([
        qlooGet<QlooInsightsResponse>('/v2/insights', { ...base, 'signal.interests.entities': signalOf(req.a) }, stats),
        qlooGet<QlooInsightsResponse>('/v2/insights', { ...base, 'signal.interests.entities': signalOf(req.b) }, stats),
        qlooGet<QlooInsightsResponse>('/v2/insights', base, stats),
      ]);
    };

    const dnaBody = await dnaPromise;
    const shared = cleanDnaTags(dnaBody.results?.tags, 'score', 6);
    const sharedNames = new Set(shared.map((t) => t.name.toLowerCase()));
    // Tags Qloo lists for both sides are common ground, not what makes each person distinct.
    const aNames = new Set((dnaBody.results?.a ?? []).map((t) => t.name.toLowerCase()));
    const both = new Set((dnaBody.results?.b ?? []).map((t) => t.name.toLowerCase()).filter((n) => aNames.has(n)));
    const notDistinct = new Set([...sharedNames, ...both]);
    const dna: TasteDna = {
      shared,
      a: cleanDnaTags(dnaBody.results?.a, 'count', 4, notDistinct),
      b: cleanDnaTags(dnaBody.results?.b, 'count', 4, notDistinct),
    };
    yield { type: 'dna', dna };
    yield {
      type: 'step',
      id: 'dna',
      label: `Mapping where ${req.a.name} and ${req.b.name}'s tastes overlap`,
      status: 'done',
      detail: shared.length
        ? `Shared: ${shared
            .slice(0, 3)
            .map((t) => t.name)
            .join(', ')}`
        : "Few shared tags — we'll find a bridge",
      ms: Math.round(now() - tDna),
    };

    if (vibeText) {
      yield { type: 'step', id: 'vibe', label: `Translating “${vibeText.slice(0, 48)}” into Qloo tags`, status: 'running' };
      const tVibe = now();
      const plan = await vibePromise;
      if (plan) {
        vibeTags = plan.boost;
        avoidTags = plan.avoid;
        if (plan.priceMax && (!priceMax || plan.priceMax < priceMax)) priceMax = plan.priceMax as 1 | 2 | 3 | 4;
        yield { type: 'vibe', tags: vibeTags, source: 'agent' };
      } else {
        vibeTags = keywordVibe(vibeText);
        yield { type: 'vibe', tags: vibeTags, source: 'keywords' };
      }
      yield {
        type: 'step',
        id: 'vibe',
        label: `Translating “${vibeText.slice(0, 48)}” into Qloo tags`,
        status: 'done',
        detail: vibeTags.length ? vibeTags.map((t) => t.name).join(' · ') : 'No matching tags; using the occasion only',
        ms: Math.round(now() - tVibe),
      };
    }

    // 2. Scout candidates near the meeting point from three angles: each person's taste and a no-taste baseline.
    yield {
      type: 'step',
      id: 'scout',
      label: `Scouting ${req.show ? `around ${req.area.label}` : req.area.label} through each person's taste`,
      status: 'running',
    };
    const tScout = now();
    let radius = req.area.radius;
    let relaxed: string | undefined;
    let [aBody, bBody, baseBody] = await scout(radius, priceMax);

    const collect = () => {
      const seen = new Map<string, QlooEntity>();
      const lists = [entitiesOf(aBody), entitiesOf(bBody), entitiesOf(baseBody)];
      const longest = Math.max(...lists.map((l) => l.length));
      for (let i = 0; i < longest; i += 1) {
        for (const list of lists) {
          const e = list[i];
          if (!e || seen.has(e.entity_id)) continue;
          if (e.properties?.is_closed) continue;
          if (!occ.allow(e.properties?.primary_genre?.id ?? '')) continue;
          const names = tagNames(e);
          if (avoidTags.some((t) => names.has(t.name.toLowerCase()))) continue;
          seen.set(e.entity_id, e);
        }
      }
      return [...seen.values()].slice(0, POOL_CAP);
    };

    let pool = collect();
    if (pool.length < 8) {
      radius = Math.round(radius * 2);
      relaxed = `Only ${pool.length} spots matched nearby, so the agent widened the search to ${(radius / 1609).toFixed(1)} miles.`;
      [aBody, bBody, baseBody] = await scout(radius, priceMax);
      pool = collect();
    }
    const popularBaseline = entitiesOf(baseBody)
      .filter((e) => occ.allow(e.properties?.primary_genre?.id ?? ''))
      .slice(0, 5)
      .map((e) => e.name);
    yield {
      type: 'step',
      id: 'scout',
      label: `Scouting ${req.show ? `around ${req.area.label}` : req.area.label} through each person's taste`,
      status: 'done',
      detail: `${pool.length} ${req.occasion === 'coffee' ? 'cafés' : 'restaurants'} in the shared pool${visited.size ? ` · skipped ${visited.size} you've been to` : ''}${relaxed ? ' · search widened' : ''}`,
      ms: Math.round(now() - tScout),
    };

    if (pool.length === 0) {
      yield {
        type: 'error',
        status: 'no_match',
        message: "No places matched every constraint here. Try a different area, a higher price ceiling, or allow places you've been.",
      };
      return;
    }

    // 3. Cross-score: ask Qloo how much EACH person would like EVERY place in the shared pool.
    yield {
      type: 'step',
      id: 'score',
      label: `Scoring all ${pool.length} spots for ${req.a.name} and for ${req.b.name}`,
      status: 'running',
    };
    const tScore = now();
    const ids = pool.map((e) => e.entity_id).join(',');
    const crossParams = {
      'filter.type': 'urn:entity:place',
      'filter.results.entities': ids,
      'feature.explainability': true,
      take: pool.length,
    };
    const [aScored, bScored] = await Promise.all([
      qlooGet<QlooInsightsResponse>('/v2/insights', { ...crossParams, 'signal.interests.entities': signalOf(req.a) }, stats),
      qlooGet<QlooInsightsResponse>('/v2/insights', { ...crossParams, 'signal.interests.entities': signalOf(req.b) }, stats),
    ]);
    const aById = new Map(entitiesOf(aScored).map((e) => [e.entity_id, e]));
    const bById = new Map(entitiesOf(bScored).map((e) => [e.entity_id, e]));
    const scored = pool.filter((e) => aById.get(e.entity_id)?.query?.affinity != null && bById.get(e.entity_id)?.query?.affinity != null);
    yield {
      type: 'step',
      id: 'score',
      label: `Scoring all ${pool.length} spots for ${req.a.name} and for ${req.b.name}`,
      status: 'done',
      detail: `${scored.length} spots scored for both people`,
      ms: Math.round(now() - tScore),
    };
    yield { type: 'pool', scored: scored.length, popularBaseline, skipped: visited.size };

    if (scored.length === 0) {
      yield { type: 'error', status: 'provider_unavailable', message: "Qloo couldn't score these places right now. Please try again." };
      return;
    }

    // 4. Negotiate: per-person normalised fit, then the fairest shared pick.
    yield { type: 'step', id: 'negotiate', label: 'Negotiating the fairest table for both of you', status: 'running' };
    const tNeg = now();
    const boostNames = new Set([...occ.boost, ...vibeTags.map((t) => t.name)].map((n) => n.toLowerCase()));
    const penaltyNames = new Set(occ.penalty.map((n) => n.toLowerCase()));
    const items: PoolItem[] = scored.map((e) => {
      const names = tagNames(e);
      const hits = [...boostNames].filter((n) => names.has(n)).length;
      const misses = [...penaltyNames].filter((n) => names.has(n)).length;
      return {
        id: e.entity_id,
        popularity: e.popularity ?? 0,
        affinityA: aById.get(e.entity_id)!.query!.affinity!,
        affinityB: bById.get(e.entity_id)!.query!.affinity!,
        contextBonus: Math.max(0, Math.min(1, hits / 3 - misses * 0.5)),
        penalty: availabilityPenalty(openStatus(e.properties?.hours, when).kind),
        rating: e.properties?.business_rating,
      };
    });
    const ranked = rankDuo(items);
    const baseA = baselineShares(scored.map((e) => aById.get(e.entity_id)));
    const baseB = baselineShares(scored.map((e) => bById.get(e.entity_id)));
    const byId = new Map(scored.map((e) => [e.entity_id, e]));
    yield {
      type: 'negotiation',
      rows: ranked.slice(0, 5).map((r) => ({ name: byId.get(r.id)!.name, rankA: r.rankA, rankB: r.rankB, of: ranked.length })),
    };
    const top = ranked.slice(0, RESULT_COUNT);
    const nameOf = (id: string) => byId.get(id)!.name;
    yield {
      type: 'contrast',
      popular: popularBaseline.slice(0, 3),
      aloneA: [...ranked]
        .sort((x, y) => x.rankA - y.rankA)
        .slice(0, 3)
        .map((r) => nameOf(r.id)),
      aloneB: [...ranked]
        .sort((x, y) => x.rankB - y.rankB)
        .slice(0, 3)
        .map((r) => nameOf(r.id)),
      together: ranked.slice(0, 3).map((r) => nameOf(r.id)),
    };
    yield {
      type: 'step',
      id: 'negotiate',
      label: 'Negotiating the fairest table for both of you',
      status: 'done',
      detail: top[0] ? `${byId.get(top[0].id)!.name}: #${top[0].rankA} for ${req.a.name}, #${top[0].rankB} for ${req.b.name}` : undefined,
      ms: Math.round(now() - tNeg),
    };

    const fit = (rank: number, f: number, d: Driver[]): PersonFit => ({ rank, of: ranked.length, fit: f, drivers: d });
    const picks: Pick[] = top.map((r) => {
      const e = byId.get(r.id)!;
      const names = tagNames(e);
      const p = e.properties ?? {};
      const occasionTags = occ.boost.filter((n) => names.has(n.toLowerCase())).slice(0, 3);
      const noise = (e.tags ?? []).find((t) => (t.type || '').includes('noise_level'))?.name;
      const vibe = (e.tags ?? [])
        .filter((t) => /ambience|decor/.test(t.type || ''))
        .map((t) => t.name)
        .filter((n, i, xs) => xs.indexOf(n) === i)
        .slice(0, 4);
      return {
        id: e.entity_id,
        name: e.name,
        image: p.image?.url,
        address: p.address,
        cuisine: genreLabel(e),
        priceLevel: p.price_level ?? null,
        rating: p.business_rating ?? null,
        distanceM: e.location ? Math.round(haversine(req.area.lat, req.area.lon, e.location.lat, e.location.lon)) : undefined,
        open: openStatus(p.hours, when),
        description: p.description,
        dishes: (p.specialty_dishes ?? []).slice(0, 3).map((d) => d.name),
        occasionTags,
        vibeTags: vibe,
        noise,
        matchedVibe: vibeTags.filter((t) => names.has(t.name.toLowerCase())).map((t) => t.name),
        website: p.website,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.name} ${p.address ?? ''}`)}`,
        fair: r.fair,
        fitA: fit(r.rankA, r.fitA, drivers(aById.get(r.id), req.a, baseA)),
        fitB: fit(r.rankB, r.fitB, drivers(bById.get(r.id), req.b, baseB)),
      };
    });

    // 5. Explain: LLM copy grounded only in the facts above; deterministic template if unavailable.
    yield { type: 'step', id: 'explain', label: 'Writing why each pick works for both of you', status: 'running' };
    const tExp = now();
    let headline: string | undefined;
    let llmUsed: string | null = null;
    try {
      const story = await narrate({
        aName: req.a.name,
        bName: req.b.name,
        aLoves: req.a.interests.map((i) => i.name),
        bLoves: req.b.interests.map((i) => i.name),
        shared: dna.shared.map((t) => t.name),
        occasion: occ.label,
        picks: picks.slice(0, 4).map((p) => ({
          id: p.id,
          name: p.name,
          cuisine: p.cuisine,
          description: p.description?.slice(0, 180),
          vibe: [...p.vibeTags, ...p.occasionTags],
          dishes: p.dishes,
          aDrivers: p.fitA.drivers.map((d) => d.name),
          bDrivers: p.fitB.drivers.map((d) => d.name),
          rankA: p.fitA.rank,
          rankB: p.fitB.rank,
          of: p.fitA.of,
        })),
      });
      if (story) {
        llmUsed = LLM_MODEL;
        headline = story.headline;
        for (const s of story.picks) {
          const pick = picks.find((p) => p.id === s.id);
          if (pick) pick.why = s.why;
        }
      }
    } catch {
      // Fall through to templates.
    }
    picks.forEach((p, i) => {
      if (!p.why)
        p.why = templateWhy(
          p,
          req,
          i,
          dna.shared.map((t) => t.name),
        );
    });
    yield {
      type: 'step',
      id: 'explain',
      label: 'Writing why each pick works for both of you',
      status: 'done',
      detail: llmUsed ? `Written by ${llmUsed} from Qloo facts only` : 'Fact templates (LLM not configured)',
      ms: Math.round(now() - tExp),
    };

    yield {
      type: 'result',
      picks,
      headline,
      relaxed,
      when: when.label,
      stats: {
        qlooCalls: stats.calls,
        cached: stats.cached,
        ms: Math.round(now() - t0),
        llm: llmUsed ?? (llmAvailable() ? 'fallback' : null),
      },
    };
  } catch (err) {
    yield {
      type: 'error',
      status: 'provider_unavailable',
      message:
        err instanceof QlooError
          ? `${err.message} Please try again in a moment.`
          : 'Something went wrong talking to Qloo. Please try again.',
    };
  }
}

function pctLabel(rank: number, of: number) {
  const pct = Math.max(1, Math.round((rank / of) * 100));
  return rank === 1 ? '#1' : `top ${pct}%`;
}

/** Deterministic, fact-only copy used when no LLM is configured (or it fails). Varies by card so it never reads canned. */
function templateWhy(p: Pick, req: MatchRequest, index: number, shared: string[]) {
  const a = p.fitA.drivers[0]?.name;
  const b = p.fitB.drivers[0]?.name;
  const cuisine = p.cuisine && p.cuisine !== 'Restaurant' ? p.cuisine : '';
  const cuisineWords = new Set(cuisine.toLowerCase().split(' '));
  const vibe = p.vibeTags
    .map((v) => v.toLowerCase())
    .filter((v) => !cuisineWords.has(v))
    .slice(0, 2)
    .join(' and ');
  const room = [vibe, cuisine, 'spot'].filter(Boolean).join(' ');
  const dish = p.dishes[0] ? ` Start with the ${p.dishes[0].toLowerCase()}.` : '';
  const sharedLine = shared.length >= 2 ? `${shared[0]!.toLowerCase()} and ${shared[1]!.toLowerCase()}` : null;

  if (a && b) return `${req.a.name}'s ${a} side and ${req.b.name}'s ${b} side both point to this ${room}.${dish}`;
  if (a || b) {
    const who = a ? req.a.name : req.b.name;
    const other = a ? req.b.name : req.a.name;
    return `Qloo ties this ${room} to ${who}'s love of ${a ?? b}, and it still lands in ${other}'s ${a ? pctLabel(p.fitB.rank, p.fitB.of) : pctLabel(p.fitA.rank, p.fitA.of)}.${dish}`;
  }
  const openers = [
    sharedLine
      ? `For two people who share a weakness for ${sharedLine}, this ${room} is the common ground.`
      : `This ${room} is the common ground.`,
    `A ${room} that neither of you has to compromise on.`,
    `The safe bet that still feels like a choice: a ${room} that suits both profiles.`,
    `Different playlists, same table: this ${room} works for both of you.`,
  ];
  return `${openers[index % openers.length]}${dish}`;
}
