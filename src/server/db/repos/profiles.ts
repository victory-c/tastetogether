import 'server-only';
import type { EntityRef, ProfileDTO, ProfileInput } from '@/lib/api-types';
import type { PriceLevel } from '@/domain/types';
import { newId, now, one, parseJson, run } from '../client';

interface ProfileRow {
  id: string;
  owner_id: string;
  display_name: string;
  area_label: string;
  center_lat: number;
  center_lon: number;
  radius_m: number;
  price_max: number | null;
  excluded_cuisines: string;
  positive_entities: string;
  is_demo: number;
  version: number;
}

export interface ProfileRecord extends ProfileDTO {
  ownerId: string;
}

function toRecord(r: ProfileRow): ProfileRecord {
  return {
    id: r.id,
    ownerId: r.owner_id,
    displayName: r.display_name,
    area: { label: r.area_label, lat: r.center_lat, lon: r.center_lon, radiusM: r.radius_m },
    priceMax: (r.price_max ?? null) as PriceLevel | null,
    excludedCuisines: parseJson<string[]>(r.excluded_cuisines, []),
    positiveEntities: parseJson<EntityRef[]>(r.positive_entities, []),
    isDemo: r.is_demo === 1,
    version: Number(r.version),
  };
}

export function toDTO({ ownerId: _ownerId, ...dto }: ProfileRecord): ProfileDTO {
  return dto;
}

export async function getProfileByOwner(ownerId: string): Promise<ProfileRecord | null> {
  const r = await one<ProfileRow>('SELECT * FROM profiles WHERE owner_id = ?', [ownerId]);
  return r ? toRecord(r) : null;
}

/** Server-internal: used by the coordinator after it has checked session membership. */
export async function getProfileById(id: string): Promise<ProfileRecord | null> {
  const r = await one<ProfileRow>('SELECT * FROM profiles WHERE id = ?', [id]);
  return r ? toRecord(r) : null;
}

export async function createProfile(ownerId: string, input: ProfileInput, isDemo = false): Promise<ProfileRecord> {
  const id = newId();
  await run(
    `INSERT INTO profiles (id, owner_id, display_name, area_label, center_lat, center_lon, radius_m, price_max, excluded_cuisines, positive_entities, is_demo, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      ownerId,
      input.displayName,
      input.area.label,
      input.area.lat,
      input.area.lon,
      Math.round(input.area.radiusM),
      input.priceMax,
      JSON.stringify(input.excludedCuisines),
      JSON.stringify(input.positiveEntities),
      isDemo ? 1 : 0,
      now(),
    ],
  );
  return (await getProfileById(id))!;
}

/** Ownership enforced in the WHERE clause. Bumps version so dependent runs go stale. */
export async function updateProfile(ownerId: string, input: ProfileInput): Promise<ProfileRecord | null> {
  const changed = await run(
    `UPDATE profiles SET display_name = ?, area_label = ?, center_lat = ?, center_lon = ?, radius_m = ?, price_max = ?, excluded_cuisines = ?, positive_entities = ?, version = version + 1, updated_at = ?
     WHERE owner_id = ?`,
    [
      input.displayName,
      input.area.label,
      input.area.lat,
      input.area.lon,
      Math.round(input.area.radiusM),
      input.priceMax,
      JSON.stringify(input.excludedCuisines),
      JSON.stringify(input.positiveEntities),
      now(),
      ownerId,
    ],
  );
  return changed ? getProfileByOwner(ownerId) : null;
}

export async function bumpProfileVersion(profileId: string): Promise<void> {
  await run('UPDATE profiles SET version = version + 1, updated_at = ? WHERE id = ?', [now(), profileId]);
}
