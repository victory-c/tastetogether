import 'server-only';
import type { MemoryDTO, MemoryInput, MemoryPatch } from '@/lib/api-types';
import * as repo from '../db/repos/memories';
import { AppError } from '../http';
import { requireProfile } from './profiles';

// Every operation resolves the caller's own profile first; ids from other profiles are not found.

export async function listMine(userId: string): Promise<MemoryDTO[]> {
  return repo.listMemories((await requireProfile(userId)).id);
}

export async function addMine(userId: string, input: MemoryInput): Promise<MemoryDTO> {
  const profile = await requireProfile(userId);
  try {
    return await repo.createMemory(profile.id, input);
  } catch (err) {
    if (err instanceof repo.DuplicateMemoryError) throw new AppError('conflict', 'This place is already in your history.');
    throw err;
  }
}

export async function editMine(userId: string, id: string, patch: MemoryPatch): Promise<MemoryDTO> {
  const profile = await requireProfile(userId);
  try {
    const m = await repo.updateMemory(profile.id, id, patch);
    if (!m) throw new AppError('not_found');
    return m;
  } catch (err) {
    if (err instanceof repo.DuplicateMemoryError) throw new AppError('conflict', 'This place is already in your history.');
    throw err;
  }
}

export async function deleteMine(userId: string, id: string): Promise<void> {
  const profile = await requireProfile(userId);
  if (!(await repo.deleteMemory(profile.id, id))) throw new AppError('not_found');
}
