import { WEEKDAYS, type Candidate, type OpenInterval, type PriceLevel, type WeeklyHours } from '@/domain/types';
import type { QlooEntity } from './types';

function hhmm(t: string | null | undefined): string | null {
  // Qloo uses "T17:00:00" with no zone; treat as venue-local.
  const m = t?.match(/T?(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function mapHours(raw: Record<string, { closed?: boolean | null; opens?: string | null; closes?: string | null }[]> | null | undefined): WeeklyHours | null {
  if (!raw) return null;
  const out: WeeklyHours = {};
  let any = false;
  for (const day of WEEKDAYS) {
    const entries = raw[day];
    if (!entries) continue;
    any = true;
    const open: OpenInterval[] = [];
    for (const e of entries) {
      if (e.closed) continue;
      const opens = hhmm(e.opens);
      const closes = hhmm(e.closes);
      if (opens && closes) open.push({ opens, closes });
    }
    out[day] = open;
  }
  return any ? out : null;
}

function price(level: number | null | undefined): PriceLevel | null {
  return level === 1 || level === 2 || level === 3 || level === 4 ? level : null;
}

export function mapEntity(e: QlooEntity): Candidate {
  const p = e.properties ?? {};
  const lat = e.location?.lat;
  const lon = e.location?.lon;
  const tags = e.tags ?? [];
  return {
    placeId: e.entity_id,
    name: e.name,
    address: p.address ?? null,
    location: typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : null,
    priceLevel: price(p.price_level),
    tagIds: tags.map((t) => t.id),
    tagNames: tags.map((t) => t.name ?? ''),
    hours: mapHours(p.hours ?? null),
    isClosed: p.is_closed ?? null,
    website: p.website ?? null,
    externalUrl: e.external?.resy?.url ?? (e.external?.google_place?.place_id ? `https://www.google.com/maps/place/?q=place_id:${e.external.google_place.place_id}` : null),
    description: p.short_description ?? p.description ?? null,
  };
}
