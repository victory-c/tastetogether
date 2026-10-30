// Fictional sample people for the one-minute demo. Clearly labeled as samples; English only.
// Restaurant entity ids are real Qloo ids (verified 2026-10-30); the people and their histories are invented.
import type { Constraints } from '@/domain/types';
import type { MemoryInput, ProfileInput } from '@/lib/api-types';

export interface DemoPerson {
  profile: ProfileInput;
  memories: MemoryInput[];
}

export const BERKELEY = { label: 'Downtown Berkeley', lat: 37.8716, lon: -122.2727, radiusM: 4000 } as const;

export const DEMO_CONSTRAINTS: Constraints = {
  area: { center: { lat: BERKELEY.lat, lon: BERKELEY.lon }, radiusM: BERKELEY.radiusM, label: BERKELEY.label },
  priceMax: 3,
  budgetNote: null,
  timeWindow: null,
  requireOpen: false,
  occasion: 'friends',
  decisionMode: 'three',
  excludeVisited: true,
  relaxations: [],
};

export const DEMO_PEOPLE: DemoPerson[] = [];
