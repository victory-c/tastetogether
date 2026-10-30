import 'server-only';

import { entitiesOf, qlooGet } from '../qloo/client';
import type { QlooInsightsResponse } from '../qloo/types';
import type { Interest, InterestKind } from './types';

const KINDS: InterestKind[] = ['artist', 'movie', 'tv_show', 'book'];

/** Resolves a free-text favorite ("Dune", "Phoebe Bridgers") to the most popular matching Qloo entity. */
export async function resolveInterest(name: string): Promise<Interest | null> {
  const body = await qlooGet<QlooInsightsResponse>('/search', {
    query: name.slice(0, 60),
    types: KINDS.map((k) => `urn:entity:${k}`).join(','),
    take: 8,
  });
  const best = entitiesOf(body)
    .filter((e) => KINDS.includes((e.types?.[0] ?? '').replace('urn:entity:', '') as InterestKind))
    .sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0))[0];
  if (!best) return null;
  const year = best.properties?.release_year ?? best.properties?.publication_year;
  return {
    id: best.entity_id,
    name: best.name,
    kind: (best.types?.[0] ?? '').replace('urn:entity:', '') as InterestKind,
    image: best.properties?.image?.url,
    year: typeof year === 'number' ? year : undefined,
  };
}

export async function resolveAll(names: string[]) {
  const out = await Promise.all(names.slice(0, 8).map((n) => resolveInterest(n).catch(() => null)));
  return out.filter((i): i is Interest => i !== null);
}
