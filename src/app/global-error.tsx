'use client';

import Link from 'next/link';

import './globals.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-ink">
        <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h1 className="font-display text-4xl font-semibold">We hit a snag</h1>
          <p className="mt-3 text-ink-soft">Something went wrong. Please try again.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className="rounded-full bg-ink px-4 py-2 font-semibold text-cream">
              Try again
            </button>
            <Link href="/match" className="rounded-full border border-line px-4 py-2 font-semibold">
              Go to match
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
