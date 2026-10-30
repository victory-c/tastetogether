import type { Constraints, ProfileDTO } from '@/lib/api-types';

export function initialConstraints(profile: ProfileDTO): Constraints {
  return {
    area: { center: { lat: profile.area.lat, lon: profile.area.lon }, radiusM: profile.area.radiusM, label: profile.area.label },
    priceMax: profile.priceMax,
    budgetNote: null,
    timeWindow: null,
    requireOpen: false,
    occasion: null,
    decisionMode: 'three',
    excludeVisited: true,
    relaxations: [],
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
