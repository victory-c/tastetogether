'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { History } from '@/components/taste/History';
import { ProfileForm } from '@/components/taste/ProfileForm';
import { Notice } from '@/components/ui';
import { copy } from '@/copy/en';
import { api, ApiClientError } from '@/lib/api-client';
import type { ProfileDTO, ProfileResponse } from '@/lib/api-types';

export default function TastePage() {
  return (
    <Suspense fallback={<p role="status">{copy.taste.loading}</p>}>
      <TasteContent />
    </Suspense>
  );
}

function TasteContent() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<ProfileResponse>('/api/profile')
      .then((data) => {
        if (active) setProfile(data.profile);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiClientError ? err.message : copy.errors.internal);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <SiteHeader compact />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{copy.taste.title}</h1>
        <p className="text-ink-soft">Save a profile for dining history and rooms; the main match flow needs no profile.</p>
        {loading && <p role="status">{copy.taste.loading}</p>}
        {error && <Notice tone="error">{error}</Notice>}
        {!loading && !error && (
          <>
            <ProfileForm
              profile={profile}
              onSaved={(saved) => {
                setProfile(saved);
                if (next && (/^\/(join|room)\/[0-9a-fA-F-]{36}$/.test(next) || next === '/solo' || next === '/room/new')) router.push(next);
              }}
            />
            {profile && <History readOnly={profile.isDemo} />}
          </>
        )}
      </main>
    </>
  );
}
