// Fictional sample people for the one-minute demo. Clearly labeled as samples; English only.
// Restaurant entity ids are real Qloo ids (verified 2026-10-30); the people and their histories are invented.
import type { Constraints } from '@/domain/types';
import type { MemoryInput, ProfileInput } from '@/lib/api-types';

export interface DemoPerson {
  profile: ProfileInput;
  memories: MemoryInput[];
}

export const BERKELEY = { label: 'Downtown Berkeley', lat: 37.8716, lon: -122.2727, radiusM: 4828 } as const;

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

export const DEMO_PEOPLE: DemoPerson[] = [
  {
    profile: {
      displayName: 'Sample Alex',
      area: BERKELEY,
      priceMax: 3,
      excludedCuisines: [],
      positiveEntities: [
        { id: 'FB20C89B-2337-4F71-9B28-DF2A7360B73A', name: 'Chez Panisse', address: '1517 Shattuck Ave. Berkeley, CA 94709' },
        { id: '19BD8668-8281-4681-8B38-E77A87F80A4E', name: 'Ramen Shop', address: '5812 College Ave Oakland, CA 94618' },
        { id: '0C944623-833F-47EA-8159-26693B514D97', name: 'À Côté', address: '5478 College Ave Oakland, CA 94618' },
      ],
    },
    memories: [
      {
        placeId: 'EC35A34F-462E-431B-AD3A-08D722667FB3',
        name: 'Ippuku',
        address: '2130 Center St Berkeley, CA 94704',
        status: 'visited',
        visitDate: null,
        rating: 'liked',
        revisitIntent: true,
      },
      {
        placeId: '97CA4EE0-0970-4293-A6D1-10563B9EA706',
        name: 'Revival Bar+Kitchen',
        address: '2102 Shattuck Ave. Berkeley, CA 94704',
        status: 'visited',
        visitDate: null,
        rating: 'neutral',
        revisitIntent: false,
      },
      {
        placeId: 'C7BEAD04-B922-4C79-A165-07556FB9E73C',
        name: 'Via del Corso',
        address: '1788 Shattuck Ave. Berkeley, CA 94709',
        status: 'want_to_try',
        visitDate: null,
      },
    ],
  },
  {
    profile: {
      displayName: 'Sample Jordan',
      area: BERKELEY,
      priceMax: 2,
      excludedCuisines: ['sushi'],
      positiveEntities: [
        {
          id: '74018DD4-A14F-4AB3-9859-55F140F1DA20',
          name: 'Cheese Board Collective Pizzeria',
          address: '1512 Shattuck Ave. Berkeley, CA 94709',
        },
        { id: '09A03EDF-7557-48EE-A543-93F9C46A43C6', name: 'Imm Thai Street Food', address: '2068 University Ave Berkeley, CA 94704' },
        // Shared with Sample Alex: the demo shows common ground, not just two unrelated lists.
        { id: '19BD8668-8281-4681-8B38-E77A87F80A4E', name: 'Ramen Shop', address: '5812 College Ave Oakland, CA 94618' },
      ],
    },
    memories: [
      {
        placeId: 'F03EC36D-C803-4F64-BB0A-D42D186A141C',
        name: 'Funky Elephant Berkeley',
        address: '1313 Ninth St Ste120 Berkeley, CA 94710',
        status: 'visited',
        visitDate: null,
        rating: 'liked',
      },
      {
        placeId: 'B67DAA8E-87FC-4ADA-AE48-8EE7A6EEB220',
        name: 'Gather in Berkeley',
        address: '2200 Oxford St Berkeley, CA 94704',
        status: 'visited',
        visitDate: null,
        rating: 'disliked',
        revisitIntent: false,
      },
      { placeId: null, name: 'Taco truck on San Pablo', address: null, status: 'visited', visitDate: null },
    ],
  },
];
