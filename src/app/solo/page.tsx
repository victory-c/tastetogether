'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { copy } from '@/copy/en';
import { api, newIdempotencyKey } from '@/lib/api-client';
import type { Constraints, ProfileResponse, Rating, RecommendationResult, RecommendResponse, Relaxation } from '@/lib/api-types';
import { Button, Notice } from '@/components/ui';
import { ConstraintsForm } from '@/components/room/ConstraintsForm';
import { ResultView } from '@/components/room/ResultView';
import { errorMessage, initialConstraints } from '@/components/room/common';

export default function SoloPage() {
  const [constraints, setConstraints] = useState<Constraints | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    Promise.all([api<ProfileResponse>('/api/profile'), api<{ result: RecommendationResult | null }>('/api/recommendations')])
      .then(([profile, latest]) => {
        if (profile.profile) setConstraints(initialConstraints(profile.profile));
        setResult(latest.result ? { ...latest.result, stale: true } : null);
      })
      .catch((e) => setMessage(errorMessage(e)))
      .finally(() => setLoaded(true));
  }, []);
  async function generate(next = constraints, skipped = rejected) {
    if (!next) return;
    setBusy(true);
    setQuerying(true);
    setMessage('');
    try {
      const data = await api<RecommendResponse>('/api/recommendations', {
        method: 'POST',
        body: { sessionId: null, idempotencyKey: newIdempotencyKey(), constraints: next, rejectedPlaceIds: skipped },
      });
      setResult(data.result);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
      setQuerying(false);
    }
  }
  async function feedback(placeId: string, kind: 'selected' | 'visited', values?: { rating: Rating; revisitIntent: boolean }) {
    if (!result?.runId) return false;
    setBusy(true);
    setMessage('');
    try {
      await api('/api/feedback', { method: 'POST', body: { runId: result.runId, placeId, kind, ...values } });
      setMessage(kind === 'visited' ? copy.room.feedbackSaved : copy.room.selected);
      return true;
    } catch (e) {
      setMessage(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function relax(r: Relaxation) {
    if (!constraints) return;
    const next = { ...constraints, relaxations: [...new Set([...constraints.relaxations, r])] };
    setConstraints(next);
    void generate(next);
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">{copy.room.solo}</h1>
      {message && <Notice>{message}</Notice>}
      {!loaded ? (
        <p>{copy.room.loading}</p>
      ) : !constraints ? (
        <Notice>
          {copy.room.profileNeeded}{' '}
          <Link className="underline" href="/taste">
            {copy.room.profileLink}
          </Link>
        </Notice>
      ) : (
        <>
          <ConstraintsForm
            value={constraints}
            onChange={(value) => {
              setConstraints(value);
              setResult((previous) => (previous ? { ...previous, stale: true } : previous));
            }}
            disabled={busy}
          />
          <Button
            disabled={busy}
            onClick={() => {
              setRejected([]);
              void generate(constraints, []);
            }}
          >
            {copy.room.find}
          </Button>
          {querying && <p>{copy.room.finding}</p>}
          {result && (
            <ResultView
              result={result}
              solo
              busy={busy}
              onTryAnother={(id) => {
                const next = [...new Set([...rejected, id])];
                setRejected(next);
                void generate(constraints, next);
              }}
              onSelect={(id) => void feedback(id, 'selected')}
              onVisited={(id, values) => feedback(id, 'visited', values)}
              onRelax={relax}
              onRetry={() => void generate()}
            />
          )}
        </>
      )}
    </main>
  );
}
