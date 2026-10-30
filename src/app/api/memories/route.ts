import type { MemoriesResponse, MemoryResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { addMine, listMine } from '@/server/services/memories';
import { memoryInputSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const GET = withUser(async (_req, userId) => {
  return ok<MemoriesResponse>({ memories: await listMine(userId) });
});

export const POST = withUser(async (req, userId) => {
  const input = await parseBody(req, memoryInputSchema);
  return ok<MemoryResponse>({ memory: await addMine(userId, input) }, 201);
});
