import { describe, expect, it } from 'vitest';

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
});
