// Shared UI primitives. Keep these small; page tasks compose them.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-orange-300',
  secondary: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 disabled:text-stone-400',
  ghost: 'text-stone-700 hover:bg-stone-100 disabled:text-stone-400',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'good' | 'sample' }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    warn: 'bg-amber-100 text-amber-800',
    good: 'bg-emerald-100 text-emerald-800',
    sample: 'bg-violet-100 text-violet-800',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/** role="alert" for errors so screen readers announce them. */
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-stone-800">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'block w-full min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200';
