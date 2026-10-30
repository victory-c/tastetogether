'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { copy } from '@/copy/en';
import { api, ApiClientError } from '@/lib/api-client';
import type { ProfileResponse } from '@/lib/api-types';
import { Button, Notice } from '@/components/ui';
import { errorMessage } from '@/components/room/common';

export default function JoinPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [next, setNext] = useState('');
  const [hasProfile, setHasProfile] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setToken(window.location.hash.slice(1));
    setNext(window.location.pathname + window.location.hash);
    api<ProfileResponse>('/api/profile')
      .then(({ profile }) => setHasProfile(!!profile))
      .catch((e) => setMessage(errorMessage(e)))
      .finally(() => setLoaded(true));
  }, []);
  async function join() {
    setBusy(true);
    setMessage('');
    try {
      await api(`/api/sessions/${id}/join`, { method: 'POST', body: { token, consent: true } });
      router.replace(`/room/${id}`);
    } catch (e) {
      setMessage(e instanceof ApiClientError && e.code === 'session_expired' ? copy.room.inviteExpired : errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">{copy.room.joinTitle}</h1>
      {message && <Notice tone="error">{message}</Notice>}
      {!loaded ? (
        <p>{copy.room.loading}</p>
      ) : !hasProfile ? (
        <Notice>
          {copy.room.joinProfile}{' '}
          <Link className="underline" href={`/taste?next=${encodeURIComponent(next)}`}>
            {copy.room.profileLink}
          </Link>
        </Notice>
      ) : !token ? (
        <Notice tone="warn">{copy.room.missingToken}</Notice>
      ) : (
        <>
          <label className="flex gap-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {copy.room.consent}
          </label>
          <Button disabled={!consent || busy} onClick={() => void join()}>
            {copy.room.join}
          </Button>
        </>
      )}
    </main>
  );
}
