// Browser-side API helper. Returns typed data or a user-safe English error; never surfaces raw upstream text.
import { copy } from '@/copy/en';
import type { ApiError, ApiErrorCode } from './api-types';

export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiClientError('internal', copy.errors.internal);
  }
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as ApiError | null;
  const code = body?.error?.code ?? 'internal';
  throw new ApiClientError(code, body?.error?.message ?? copy.errors[code] ?? copy.errors.internal);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
