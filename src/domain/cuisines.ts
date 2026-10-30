// Cuisines a user can hard-exclude. Matched against Qloo tag ids
// (urn:tag:cuisine:qloo:* and urn:tag:genre:place:restaurant:*).

export interface CuisineOption {
  key: string;
  label: string;
  tokens: string[];
}

export const CUISINE_OPTIONS: CuisineOption[] = [
  { key: 'seafood', label: 'Seafood', tokens: ['seafood', 'sushi', 'oyster', 'fish', 'poke', 'crab', 'lobster'] },
  { key: 'sushi', label: 'Sushi', tokens: ['sushi', 'omakase'] },
  { key: 'japanese', label: 'Japanese', tokens: ['japanese', 'izakaya', 'ramen', 'sushi', 'yakitori'] },
  { key: 'chinese', label: 'Chinese', tokens: ['chinese', 'dim_sum', 'cantonese', 'sichuan', 'szechuan', 'hunan', 'taiwanese'] },
  { key: 'korean', label: 'Korean', tokens: ['korean'] },
  { key: 'thai', label: 'Thai', tokens: ['thai'] },
  { key: 'indian', label: 'Indian', tokens: ['indian', 'south_asian', 'pakistani', 'nepalese'] },
  { key: 'mexican', label: 'Mexican', tokens: ['mexican', 'taqueria', 'tacos', 'tamales', 'burrito'] },
  { key: 'italian', label: 'Italian', tokens: ['italian', 'pizza', 'pasta', 'trattoria'] },
  { key: 'pizza', label: 'Pizza', tokens: ['pizza'] },
  { key: 'french', label: 'French', tokens: ['french', 'brasserie', 'bistro'] },
  { key: 'mediterranean', label: 'Mediterranean', tokens: ['mediterranean', 'greek', 'middle_eastern', 'mezze', 'lebanese', 'turkish'] },
  { key: 'american', label: 'American', tokens: ['american', 'burger', 'diner'] },
  { key: 'bbq', label: 'Barbecue', tokens: ['bbq', 'barbecue', 'smokehouse'] },
  { key: 'steakhouse', label: 'Steakhouse', tokens: ['steak'] },
  { key: 'vegan', label: 'Vegan / vegetarian', tokens: ['vegan', 'vegetarian'] },
  { key: 'spicy', label: 'Spicy-focused', tokens: ['sichuan', 'szechuan', 'hot_pot', 'nashville_hot'] },
];

const CUISINE_TAG_PREFIXES = ['urn:tag:cuisine:', 'urn:tag:genre:place:restaurant:'];

function tagSlug(tagId: string): string | null {
  for (const prefix of CUISINE_TAG_PREFIXES) {
    if (tagId.startsWith(prefix)) {
      const rest = tagId.slice(prefix.length);
      // urn:tag:cuisine:qloo:<slug>
      return rest.includes(':') ? rest.slice(rest.lastIndexOf(':') + 1) : rest;
    }
  }
  return null;
}

/** Returns the first excluded cuisine key that a venue's tags hit, or null. */
export function matchExcludedCuisine(tagIds: string[], excludedKeys: string[]): string | null {
  if (excludedKeys.length === 0) return null;
  const slugs = tagIds.map(tagSlug).filter((s): s is string => s !== null);
  for (const key of excludedKeys) {
    const option = CUISINE_OPTIONS.find((o) => o.key === key);
    if (!option) continue;
    if (slugs.some((slug) => option.tokens.some((token) => slug === token || slug.includes(token)))) return key;
  }
  return null;
}

/** Human-readable cuisines from tags, for display. Names come from Qloo tag names. */
export function cuisineNames(tagIds: string[], tagNames: string[]): string[] {
  const out: string[] = [];
  tagIds.forEach((id, i) => {
    if (id.startsWith('urn:tag:genre:place:restaurant:') && tagNames[i] && !out.includes(tagNames[i]!)) out.push(tagNames[i]!);
  });
  return out.slice(0, 3);
}
