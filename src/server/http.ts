import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import type { ApiError, ApiErrorCode } from '@/lib/api-types';
import { copy } from '@/copy/en';
import { requireUserId } from './auth/session';

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  conflict: 409,
  profile_required: 409,
  session_expired: 410,
  rate_limited: 429,
  provider_unavailable: 503,
  internal: 500,
};

/** Thrown by services; mapped to a user-safe English message. Upstream error text is never forwarded. */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly userMessage?: string,
  ) {
    super(code);
  }
}

export function ok<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(code: ApiErrorCode, message?: string): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message: message ?? copy.errors[code] } }, { status: STATUS[code], headers: { 'Cache-Control': 'no-store' } });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError('invalid_input');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AppError('invalid_input');
  return parsed.data;
}

/**
 * Wrap a route handler: resolves the caller's identity and maps errors.
 * Every route that touches user data must go through this.
 */
export function withUser<C>(handler: (req: Request, userId: string, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const userId = await requireUserId();
      return await handler(req, userId, ctx);
    } catch (err) {
      if (err instanceof AppError) return fail(err.code, err.userMessage);
      console.error('[api] unhandled', err instanceof Error ? err.message : 'unknown');
      return fail('internal');
    }
  };
}
