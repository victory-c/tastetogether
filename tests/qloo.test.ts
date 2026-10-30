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

describe('/search response shape (synthetic sample)', () => {
  it('maps tags keyed by tag_id (search) the same as id (insights)', async () => {
    const { default: raw } = await import('../src/server/qloo/fixtures/search-sample.json');
    const { parseEntities, searchResponseSchema } = await import('../src/server/qloo/types');
    const { mapEntity } = await import('../src/server/qloo/map');
    const entities = parseEntities(searchResponseSchema.parse(raw).results);
    expect(entities).toHaveLength(1);
    const c = mapEntity(entities[0]!);
    expect(c.name).toBe('Fixture Bistro');
    expect(c.tagIds.length).toBeGreaterThan(0);
    expect(c.tagIds.every((id) => id.startsWith('urn:tag:'))).toBe(true);
  });
});
