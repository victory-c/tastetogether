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
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:py-16">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">{copy.brand}</h1>
          <p className="text-lg text-stone-600">{copy.tagline}</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <Card className="max-w-2xl !p-6">
          <div className="flex flex-col items-stretch gap-3">
            <Button className="min-h-12 text-base" disabled={busy} onClick={() => run('load')}>
              {copy.home.demo}
            </Button>
            <p className="text-sm text-stone-600">{copy.home.demoHint}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" disabled={busy} onClick={() => run('solo')}>
                {copy.home.startSolo}
              </Button>
              <Link
                className="flex min-h-11 items-center justify-center rounded-lg border border-stone-300 px-4 text-sm font-medium hover:bg-stone-100"
                href="/room/new"
              >
                {copy.home.invite}
              </Link>
            </div>
            <Button className="self-start !px-0 text-xs" variant="ghost" disabled={busy} onClick={() => run('reset')}>
              {copy.home.reset}
            </Button>
            {busy && (
              <p role="status" className="text-sm">
                {copy.home.loading}
              </p>
            )}
          </div>
        </Card>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{copy.home.howItWorks}</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {copy.home.steps.map((step, i) => (
              <li key={step} className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
                <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
