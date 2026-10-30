import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MatchApp } from '@/components/MatchApp';

export const metadata: Metadata = {
  title: 'Find your table — TasteTogether',
};

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MatchApp />
    </Suspense>
  );
}
