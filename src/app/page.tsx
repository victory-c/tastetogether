'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Notice } from '@/components/ui';
import { copy } from '@/copy/en';
import { api, ApiClientError } from '@/lib/api-client';
import type { DemoResponse, ProfileResponse } from '@/lib/api-types';

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function run(action: 'solo' | 'load' | 'reset') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (action === 'solo') {
        const { profile } = await api<ProfileResponse>('/api/profile');
        router.push(profile ? '/solo' : '/taste');
      } else {
        const result = await api<DemoResponse>('/api/demo', { method: 'POST', body: { action } });
        if (action === 'load') {
          if (!result.sessionId) throw new ApiClientError('internal', copy.errors.internal);
          router.push(`/room/${encodeURIComponent(result.sessionId)}`);
        } else setMessage(copy.home.resetDone);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : copy.errors.internal);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-6 p-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold">{copy.brand}</h1>
          <p className="mt-2 text-stone-600">{copy.tagline}</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <Card>
          <div className="flex flex-col items-stretch gap-3">
            <Button disabled={busy} onClick={() => run('solo')}>
              {copy.home.startSolo}
            </Button>
            <Link
              className="flex min-h-11 items-center justify-center rounded-lg border border-stone-300 px-4 text-sm font-medium hover:bg-stone-100"
              href="/room/new"
            >
              {copy.home.invite}
            </Link>
            <Button variant="secondary" disabled={busy} onClick={() => run('load')}>
              {copy.home.demo}
            </Button>
            <p className="text-sm text-stone-600">{copy.home.demoHint}</p>
            <Button variant="ghost" disabled={busy} onClick={() => run('reset')}>
              {copy.home.reset}
            </Button>
            {busy && (
              <p role="status" className="text-sm">
                {copy.home.loading}
              </p>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}
