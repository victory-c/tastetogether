// Applies the idempotent schema to DATABASE_URL (or the local file DB). The app also migrates on first query.
// Usage: npm run db:migrate
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { migrate } from '../src/server/db/client';

const url = process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? 'file:./data/local.db';
if (url.startsWith('file:')) mkdirSync('./data', { recursive: true });
const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN });
await migrate(db);
console.log(`Schema is up to date at ${url.startsWith('file:') ? url : new URL(url).host}`);
