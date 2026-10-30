import 'server-only';
import type { ProfileInput } from '@/lib/api-types';
import { createProfile, getProfileByOwner, updateProfile, type ProfileRecord } from '../db/repos/profiles';
import { AppError } from '../http';

export async function requireProfile(userId: string): Promise<ProfileRecord> {
  const p = await getProfileByOwner(userId);
  if (!p) throw new AppError('profile_required');
  return p;
}

export async function upsertProfile(userId: string, input: ProfileInput): Promise<ProfileRecord> {
  const existing = await getProfileByOwner(userId);
  if (existing?.isDemo) throw new AppError('forbidden');
  if (existing) return (await updateProfile(userId, input))!;
  return createProfile(userId, input);
}
