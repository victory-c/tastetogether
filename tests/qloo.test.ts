import { describe, expect, it } from 'vitest';
import insights from '@/server/qloo/fixtures/insights.json';
import search from '@/server/qloo/fixtures/search.json';
import { insightsResponseSchema, parseEntities, searchResponseSchema } from '@/server/qloo/types';
import { mapEntity } from '@/server/qloo/map';

describe('Qloo response parsing', () => {
  it('normalizes insights arrays and drops malformed entities independently', () => {
    const entities = parseEntities(insightsResponseSchema.parse(insights).results.entities);
    expect(entities).toHaveLength(1);
    const mapped = mapEntity(entities[0]!);
    expect(mapped.externalUrl).toBe('https://resy.com/example');
    expect(mapped.priceLevel).toBeNull();
    expect(mapped.hours).toEqual({ monday: [{ opens: '17:00', closes: '23:00' }], tuesday: [] });
  });
  it('normalizes search objects and falls back to Google Maps', () => {
    const entities = parseEntities(searchResponseSchema.parse(search).results);
    expect(mapEntity(entities[0]!).externalUrl).toBe('https://resy.com/search');
    expect(mapEntity(entities[0]!).priceLevel).toBe(2);
    expect(mapEntity(entities[1]!).externalUrl).toContain('google-3');
  });
});
