import Link from "next/link";

import { Logo } from "./Logo";

export const REPO_URL = "https://github.com/victory-c/tastetogether";

export function SiteHeader({ compact }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium text-ink-soft">
          {!compact && (
            <Link href="/#how" className="hidden rounded-full px-3 py-2 transition hover:text-ink sm:block">
              How it works
            </Link>
          )}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hidden rounded-full px-3 py-2 transition hover:text-ink sm:block">
            GitHub
          </a>
          <Link href="/match?demo=maya-leo&go=1" className="rounded-full bg-ink px-4 py-2 font-semibold text-cream transition hover:bg-ink/85">
            Try the demo
          </Link>
        </nav>
      </div>
    </header>
  );
}
