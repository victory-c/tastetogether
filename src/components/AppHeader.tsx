import Link from 'next/link';
import { copy } from '@/copy/en';

export function AppHeader() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2" aria-label={copy.brand}>
        <Link className="flex min-h-11 items-center font-semibold" href="/">
          {copy.brand}
        </Link>
        <Link className="flex min-h-11 items-center text-sm" href="/taste">
          {copy.home.myTaste}
        </Link>
        <Link className="flex min-h-11 items-center text-sm" href="/solo">
          {copy.home.solo}
        </Link>
        <Link className="flex min-h-11 items-center text-sm" href="/room/new">
          {copy.home.invite}
        </Link>
      </nav>
    </header>
  );
}
