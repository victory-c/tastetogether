import { createClient } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { __setClientForTests, all, run } from '@/server/db/client';
import { ensureUser } from '@/server/db/repos/users';
import { loadDemo } from '@/server/services/demo';

describe('sample rooms expire', () => {
  beforeEach(async () => {
    await __setClientForTests(createClient({ url: 'file::memory:' }));
  });

  it('purges demo rooms older than two days on the next load, and keeps fresh ones', async () => {
    await ensureUser('visitor-1');
    await ensureUser('visitor-2');
    const old = await loadDemo('visitor-1');
    await run('UPDATE match_sessions SET created_at = ? WHERE id = ?', [new Date(Date.now() - 3 * 86_400_000).toISOString(), old]);
    const fresh = await loadDemo('visitor-2');
    const ids = (await all<{ id: string }>('SELECT id FROM match_sessions')).map((r) => r.id);
    expect(ids).toContain(fresh);
    expect(ids).not.toContain(old);
    const demoProfiles = await all<{ n: number }>('SELECT count(*) AS n FROM profiles WHERE is_demo = 1');
    expect(Number(demoProfiles[0]!.n)).toBe(2);
  });
});
