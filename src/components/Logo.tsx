import Link from 'next/link';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12" cy="16" r="9" fill="var(--color-a)" />
      <circle cx="20" cy="16" r="9" fill="var(--color-b)" style={{ mixBlendMode: 'multiply' }} />
      <path d="M16 8.5a9 9 0 0 1 0 15 9 9 0 0 1 0-15Z" fill="#c447b8" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-full pr-2" aria-label="TasteTogether home">
      <LogoMark />
      <span className="font-display text-[1.35rem] leading-none font-semibold tracking-tight">
        Taste<span className="italic font-normal">Together</span>
      </span>
    </Link>
  );
}
