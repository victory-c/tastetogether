import Link from 'next/link';

import { SiteHeader } from '@/components/SiteHeader';

export default function NotFound() {
  return (
    <>
      <SiteHeader compact />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-semibold">We hit a snag</h1>
        <p className="mt-3 text-ink-soft">We couldn't find that page.</p>
        <Link href="/match" className="mt-6 inline-block rounded-full bg-ink px-4 py-2 font-semibold text-cream">
          Go to match
        </Link>
      </main>
    </>
  );
}
