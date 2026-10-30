'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { copy } from '@/copy/en';
import { api, ApiClientError, newIdempotencyKey } from '@/lib/api-client';
import type {
  Constraints,
  Rating,
  RecommendationResult,
  RecommendResponse,
  Relaxation,
  SessionDTO,
  SessionResponse,
} from '@/lib/api-types';
import { Badge, Button, Notice } from '@/components/ui';
import { ConstraintsForm } from '@/components/room/ConstraintsForm';
import { ResultView } from '@/components/room/ResultView';
import { errorMessage } from '@/components/room/common';

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [draft, setDraft] = useState<Constraints | null>(null);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(
    async (force = false) => {
      try {
        const data = await api<SessionResponse>(`/api/sessions/${id}`);
        setSession((previous) => (dirty && !force && previous ? { ...data.session, version: previous.version } : data.session));
        if (force || !dirty) setDraft(data.session.constraints);
        setResult(data.session.latestResult);
        return data.session;
      } catch (e) {
        setMessage(
          e instanceof ApiClientError && e.code === 'not_found'
            ? copy.room.notFound
            : e instanceof ApiClientError && e.code === 'session_expired'
              ? copy.room.expired
              : errorMessage(e),
        );
      } finally {
        setLoaded(true);
      }
    },
    [id, dirty],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const update = () => {
      if (!document.hidden && !busy) void refresh();
    };
    const interval = ['waiting_for_partner', 'pending_confirmation', 'querying'].includes(session.state) ? 4000 : 10000;
    const timer = window.setInterval(update, interval);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [session?.state, refresh, busy]);
  async function save(next: Constraints) {
    if (!session) return false;
    setBusy(true);
    setMessage('');
    try {
      const data = await api<SessionResponse>(`/api/sessions/${id}/constraints`, {
        method: 'PATCH',
        body: { constraints: next, expectedVersion: session.version },
      });
      setSession(data.session);
      setDraft(data.session.constraints);
      setResult(data.session.latestResult);
      setDirty(false);
      return true;
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'conflict') {
        const latest = await refresh(true);
        setDirty(false);
        setMessage(latest && latest.version !== session.version ? copy.room.conflict : e.message);
      } else setMessage(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!session) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await api<SessionResponse>(`/api/sessions/${id}/confirm`, {
        method: 'POST',
        body: { expectedVersion: session.version },
      });
      setSession(data.session);
      setResult(data.session.latestResult);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'conflict') {
        const latest = await refresh(true);
        setDirty(false);
        setMessage(latest && latest.version !== session.version ? copy.room.conflict : e.message);
      } else setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    setQuerying(true);
    setMessage('');
    try {
      const data = await api<RecommendResponse>('/api/recommendations', {
        method: 'POST',
        body: { sessionId: id, idempotencyKey: newIdempotencyKey() },
      });
      setResult(data.result);
      await refresh();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
      setQuerying(false);
    }
  }
  async function reject(placeId: string) {
    setBusy(true);
    setMessage('');
    try {
      await api(`/api/sessions/${id}/reject`, { method: 'POST', body: { placeId } });
      await generate();
    } catch (e) {
      setMessage(errorMessage(e));
      setBusy(false);
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
  async function newInvite() {
    setBusy(true);
    setMessage('');
    try {
      const data = await api<SessionResponse>(`/api/sessions/${id}/invite`, { method: 'POST' });
      setSession(data.session);
      setInvite(data.session.inviteUrl);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const joined = session?.participants.length === 2 && session.participants.every((p) => p.joined);
  const ready = joined && session?.participants.every((p) => p.confirmed);
  function relax(r: Relaxation) {
    if (draft) void save({ ...draft, relaxations: [...new Set([...draft.relaxations, r])] });
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">
        {copy.room.roomTitle} {session?.isDemo && <Badge tone="sample">{copy.sampleBadge}</Badge>}
      </h1>
      {message && <Notice>{message}</Notice>}
      {!loaded ? (
        <p>{copy.room.loading}</p>
      ) : (
        session &&
        draft && (
          <>
            <section>
              <h2 className="text-xl font-semibold">{copy.room.participants}</h2>
              <ul>
                {session.participants.map((p) => (
                  <li key={p.key}>
                    {p.displayName} {p.isYou && `(${copy.room.you})`} — {p.joined ? copy.room.joined : copy.room.notJoined},{' '}
                    {p.confirmed ? copy.room.confirmed : copy.room.notConfirmed}
                  </li>
                ))}
              </ul>
            </section>
            {session.you === 'A' && !session.participants.some((p) => p.key === 'B' && p.joined) && (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => void newInvite()}>
                  {copy.room.newInvite}
                </Button>
                {invite && (
                  <>
                    <p className="break-all">{invite}</p>
                    <p>{copy.room.inviteNote}</p>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(invite)
                          .then(() => setMessage(copy.room.copied))
                          .catch((e) => setMessage(errorMessage(e)))
                      }
                    >
                      {copy.room.copyLink}
                    </Button>
                  </>
                )}
              </>
            )}
            <ConstraintsForm
              value={draft}
              disabled={busy}
              onChange={(value) => {
                setDraft(value);
                setDirty(true);
              }}
            />
            <p>{copy.room.confirmNote}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy || !dirty} onClick={() => void save(draft)}>
                {copy.room.save}
              </Button>
              <Button variant="secondary" disabled={busy || dirty || !joined} onClick={() => void confirm()}>
                {copy.room.confirm}
              </Button>
              <Button disabled={busy || dirty || !ready} onClick={() => void generate()}>
                {copy.room.generate}
              </Button>
            </div>
            {querying && <p>{copy.room.finding}</p>}
            {result && (
              <ResultView
                result={result}
                busy={busy}
                actionsDisabled={dirty}
                retryDisabled={!ready || dirty}
                onTryAnother={(placeId) => void reject(placeId)}
                onSelect={(placeId) => void feedback(placeId, 'selected')}
                onVisited={(placeId, values) => feedback(placeId, 'visited', values)}
                onRelax={relax}
                onRetry={() => {
                  if (ready && !dirty) void generate();
                }}
              />
            )}
          </>
        )
      )}
    </main>
  );
}
