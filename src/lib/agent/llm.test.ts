import { describe, expect, it, vi } from 'vitest';

import { keywordVibe, uniqueByName } from './llm';

describe('uniqueByName', () => {
  it('keeps the first tag of each name, ignoring case', () => {
    const tags = [
      { id: 'urn:tag:ambience:qloo:cozy', name: 'Cozy' },
      { id: 'urn:tag:ambience:place:cozy', name: 'Cozy' },
      { id: 'urn:tag:ambience:qloo:cozy_atmosphere', name: 'Cozy Atmosphere' },
      { id: 'urn:tag:noise_level:place:quiet', name: 'quiet' },
      { id: 'urn:tag:ambience:qloo:quiet', name: 'Quiet' },
    ];
    expect(uniqueByName(tags).map((t) => t.id)).toEqual([
      'urn:tag:ambience:qloo:cozy',
      'urn:tag:ambience:qloo:cozy_atmosphere',
      'urn:tag:noise_level:place:quiet',
    ]);
  });
});

describe('keywordVibe', () => {
  it('reads negation and never repeats a tag', () => {
    expect(keywordVibe('cozy and quiet, not too loud').map((t) => t.name)).toEqual(['Quiet', 'Cozy']);
  });

  it('skips asks the text rules out and words inside other words', () => {
    expect(keywordVibe('nothing fancy, we are broke students')).toEqual([]);
    expect(keywordVibe('good reviews, not too lively')).toEqual([]);
    expect(keywordVibe('nothing stuffy').map((t) => t.name)).toEqual(['Relaxed']);
  });

  it('groups synonyms under the word that asked for them', () => {
    expect(keywordVibe('romantic and quiet').map((t) => [t.name, t.concept])).toEqual([
      ['Quiet', 'quiet'],
      ['Romantic', 'romantic'],
      ['Intimate', 'romantic'],
    ]);
  });
});

describe('remembered vibe plans', () => {
  it('has an agent-produced plan for every sample duo, so demos never wait on the model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-only-for-availability-check');
    const { KNOWN_VIBES, rememberedVibe } = await import('./llm');
    const { SAMPLE_DUOS } = await import('../taste/samples');
    for (const duo of SAMPLE_DUOS) {
      const plan = rememberedVibe(duo.vibe, duo.occasion);
      expect(plan, `${duo.id} (${duo.occasion}|${duo.vibe})`).not.toBeNull();
      expect(plan!.boost.length + plan!.avoid.length).toBeGreaterThan(0);
      // Only real Qloo taxonomy ids, never name:* placeholders from the keyword fallback.
      for (const t of [...plan!.boost, ...plan!.avoid]) expect(t.id).toMatch(/^urn:tag:/);
    }
    expect(Object.keys(KNOWN_VIBES).length).toBeGreaterThanOrEqual(SAMPLE_DUOS.length);
    vi.unstubAllEnvs();
  });
});
