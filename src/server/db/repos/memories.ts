import 'server-only';
import type { MemoryDTO, MemoryInput, MemoryPatch } from '@/lib/api-types';
import type { MemoryStatus, Rating } from '@/domain/types';
import { all, newId, now, one, run } from '../client';
import { bumpProfileVersion } from './profiles';

interface MemoryRow {
  id: string;
  profile_id: string;
  place_id: string | null;
  unresolved_name: string | null;
  name: string;
  address: string | null;
  status: MemoryStatus;
  visit_date: string | null;
  visit_count: number | null;
  rating: Rating | null;
  revisit_intent: number | null;
  source: MemoryDTO['source'];
  created_at: string;
  updated_at: string;
}

function toDTO(r: MemoryRow): MemoryDTO {
  return {
    id: r.id,
    placeId: r.place_id,
    name: r.name,
    address: r.address,
    status: r.status,
    visitDate: r.visit_date,
    visitCount: r.visit_count === null ? null : Number(r.visit_count),
    rating: r.rating,
    revisitIntent: r.revisit_intent === null ? null : r.revisit_intent === 1,
    source: r.source,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class DuplicateMemoryError extends Error {}

export async function listMemories(profileId: string): Promise<MemoryDTO[]> {
  const rows = await all<MemoryRow>('SELECT * FROM memories WHERE profile_id = ? ORDER BY updated_at DESC', [profileId]);
  return rows.map(toDTO);
}

export async function createMemory(profileId: string, input: MemoryInput, source: MemoryDTO['source'] = 'manual'): Promise<MemoryDTO> {
  const id = newId();
  const ts = now();
  try {
    await run(
      `INSERT INTO memories (id, profile_id, place_id, unresolved_name, name, address, status, visit_date, visit_count, rating, revisit_intent, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        profileId,
        input.placeId,
        input.placeId ? null : input.name,
        input.name,
        input.address,
        input.status,
        input.visitDate ?? null,
        input.visitCount ?? null,
        input.rating ?? null,
        boolToInt(input.revisitIntent),
        source,
        ts,
        ts,
      ],
    );
  } catch (err) {
    if (String(err).includes('UNIQUE')) throw new DuplicateMemoryError('This place is already in your history');
    throw err;
  }
  await bumpProfileVersion(profileId);
  return (await getMemory(profileId, id))!;
}

/** Scoped by profile: a memory id from another profile is simply not found. */
export async function getMemory(profileId: string, id: string): Promise<MemoryDTO | null> {
  const r = await one<MemoryRow>('SELECT * FROM memories WHERE id = ? AND profile_id = ?', [id, profileId]);
  return r ? toDTO(r) : null;
}

export async function findMemoryByPlace(profileId: string, placeId: string): Promise<MemoryDTO | null> {
  const r = await one<MemoryRow>('SELECT * FROM memories WHERE profile_id = ? AND place_id = ?', [profileId, placeId]);
  return r ? toDTO(r) : null;
}

export async function updateMemory(profileId: string, id: string, patch: MemoryPatch): Promise<MemoryDTO | null> {
  const current = await getMemory(profileId, id);
  if (!current) return null;
  const next = { ...current, ...patch };
  try {
    await run(
      `UPDATE memories SET place_id = ?, unresolved_name = ?, name = ?, address = ?, status = ?, visit_date = ?, visit_count = ?, rating = ?, revisit_intent = ?, updated_at = ?
       WHERE id = ? AND profile_id = ?`,
      [
        next.placeId,
        next.placeId ? null : next.name,
        next.name,
        next.address,
        next.status,
        next.visitDate ?? null,
        next.visitCount ?? null,
        next.rating ?? null,
        boolToInt(next.revisitIntent),
        now(),
        id,
        profileId,
      ],
    );
  } catch (err) {
    if (String(err).includes('UNIQUE')) throw new DuplicateMemoryError('This place is already in your history');
    throw err;
  }
  await bumpProfileVersion(profileId);
  return getMemory(profileId, id);
}

export async function deleteMemory(profileId: string, id: string): Promise<boolean> {
  const n = await run('DELETE FROM memories WHERE id = ? AND profile_id = ?', [id, profileId]);
  if (n) await bumpProfileVersion(profileId);
  return n > 0;
}

function boolToInt(v: boolean | null | undefined): number | null {
  return v === undefined || v === null ? null : v ? 1 : 0;
}
