import type { MemoryResponse } from '@/lib/api-types';
import { ok, parseBody, withUser } from '@/server/http';
import { deleteMine, editMine } from '@/server/services/memories';
import { memoryPatchSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser<Ctx>(async (req, userId, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, memoryPatchSchema);
  return ok<MemoryResponse>({ memory: await editMine(userId, id, input) });
});

export const DELETE = withUser<Ctx>(async (_req, userId, { params }) => {
  const { id } = await params;
  await deleteMine(userId, id);
  return ok<{ ok: true }>({ ok: true });
});
