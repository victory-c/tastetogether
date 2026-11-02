// Shared UI primitives. Keep these small; page tasks compose them.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-cream hover:bg-ink/85 disabled:opacity-40',
  secondary: 'border border-line bg-paper text-ink hover:border-ink/30 disabled:opacity-40',
  ghost: 'text-ink-soft hover:bg-cream disabled:opacity-40',
  danger: 'border border-a/30 bg-paper text-a-deep hover:bg-a-soft',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[28px] border border-line bg-paper/90 p-5 shadow-card sm:p-6 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'good' | 'sample' }) {
  const tones = {
    neutral: 'bg-cream text-ink-soft',
    warn: 'bg-amber/15 text-ink',
    good: 'bg-mint-soft text-mint',
    sample: 'bg-b-soft text-b-deep',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/** role="alert" for errors so screen readers announce them. */
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const tones = {
    info: 'border-line bg-cream text-ink',
    warn: 'border-amber/30 bg-amber/10 text-ink',
    error: 'border-a/30 bg-a-soft text-a-deep',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'block w-full min-h-11 rounded-xl border border-line bg-cream/60 px-3 text-sm focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-a/15';
