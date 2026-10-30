import 'server-only';
import { createClient, type Client, type InArgs } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { MIGRATIONS } from './migrations';

let client: Client | null = null;
let ready: Promise<void> | null = null;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) throw new Error('DATABASE_URL must be set in production');
  mkdirSync('./data', { recursive: true });
  return 'file:./data/local.db';
}

export async function migrate(db: Client): Promise<void> {
  await db.execute('PRAGMA foreign_keys = ON').catch(() => undefined);
  for (const sql of MIGRATIONS) await db.execute(sql);
}

export async function db(): Promise<Client> {
  if (!client) {
    client = createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
    ready = migrate(client);
  }
  await ready;
  return client;
}

/** Test hook: point the module at an isolated database. */
export function __setClientForTests(c: Client): Promise<void> {
  client = c;
  ready = migrate(c);
  return ready;
}

export async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const res = await (await db()).execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function one<T>(sql: string, args: InArgs = []): Promise<T | null> {
  return (await all<T>(sql, args))[0] ?? null;
}

export async function run(sql: string, args: InArgs = []): Promise<number> {
  const res = await (await db()).execute({ sql, args });
  return res.rowsAffected;
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export const parseJson = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string') return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
