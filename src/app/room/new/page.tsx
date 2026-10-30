'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { copy } from '@/copy/en';
import { api } from '@/lib/api-client';
import type { Constraints, ProfileResponse, SessionDTO, SessionResponse } from '@/lib/api-types';
import { Button, Notice } from '@/components/ui';
import { ConstraintsForm } from '@/components/room/ConstraintsForm';
import { errorMessage, initialConstraints } from '@/components/room/common';

export default function NewRoomPage() {
  const [constraints, setConstraints] = useState<Constraints | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    api<ProfileResponse>('/api/profile')
      .then(({ profile }) => {
        if (profile) setConstraints(initialConstraints(profile));
      })
      .catch((e) => setMessage(errorMessage(e)))
      .finally(() => setLoaded(true));
  }, []);
  async function create() {
    setBusy(true);
    setMessage('');
    try {
      const data = await api<SessionResponse>('/api/sessions', { method: 'POST', body: { constraints } });
      setSession(data.session);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">{copy.room.createTitle}</h1>
      {message && <Notice>{message}</Notice>}
      {!loaded ? (
        <p>{copy.room.loading}</p>
      ) : !constraints ? (
        <Notice>
          {copy.room.profileNeeded}{' '}
          <Link className="underline" href="/taste?next=%2Froom%2Fnew">
            {copy.room.profileLink}
          </Link>
        </Notice>
      ) : session ? (
        <>
          <p>{copy.room.inviteNote}</p>
          {session.inviteUrl && (
            <>
              <p className="break-all">{session.inviteUrl}</p>
              <Button
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(session.inviteUrl!)
                    .then(() => setMessage(copy.room.copied))
                    .catch((e) => setMessage(errorMessage(e)))
                }
              >
                {copy.room.copyLink}
              </Button>
            </>
          )}
          <p>
            <Link className="text-orange-700 underline" href={`/room/${session.id}`}>
              {copy.room.openRoom}
            </Link>
          </p>
        </>
      ) : (
        <>
          <ConstraintsForm value={constraints} onChange={setConstraints} disabled={busy} />
          <Button disabled={busy} onClick={() => void create()}>
            {copy.room.create}
          </Button>
        </>
      )}
    </main>
  );
}
