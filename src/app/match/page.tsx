import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MatchApp } from '@/components/MatchApp';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Find your table — TasteTogether',
};

export default function MatchPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader compact />
          <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-label="Loading match">
            <div className="skeleton h-10 w-64 max-w-full rounded-full" />
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="skeleton h-64 rounded-[28px]" />
              ))}
            </div>
          </main>
        </>
      }
    >
      <MatchApp />
    </Suspense>
  );
}
