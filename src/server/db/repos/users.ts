import 'server-only';
import { now, run } from '../client';

export async function ensureUser(id: string): Promise<void> {
  await run('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)', [id, now()]);
}
