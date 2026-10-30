import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { ensureUser } from '../db/repos/users';

const COOKIE = 'tt_uid';
const MAX_AGE_S = 60 * 60 * 24 * 180;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET (>= 32 chars) must be set in production');
  return 'dev-only-insecure-session-secret-change-me';
}

function sign(uid: string): string {
  return createHmac('sha256', secret()).update(uid).digest('base64url');
}

export function verifyCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const uid = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(uid));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return uid;
}

/** The current anonymous user, or null. Never creates one (safe for GET). */
export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return verifyCookieValue(jar.get(COOKIE)?.value);
}

/** The current user, issuing a new server-signed identity if the browser has none. */
export async function requireUserId(): Promise<string> {
  const existing = await currentUserId();
  if (existing) {
    await ensureUser(existing);
    return existing;
  }
  const uid = crypto.randomUUID();
  await ensureUser(uid);
  const jar = await cookies();
  jar.set(COOKIE, `${uid}.${sign(uid)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_S,
  });
  return uid;
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
