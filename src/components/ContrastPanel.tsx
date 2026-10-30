'use client';

import clsx from 'clsx';
import { motion } from 'motion/react';

export function ContrastPanel({
  aName,
  bName,
  contrast,
}: {
  aName: string;
  bName: string;
  contrast: { popular: string[]; aloneA: string[]; aloneB: string[]; together: string[] };
}) {
  const popular = new Set(contrast.popular);
  const cols = [
    { title: 'Popular nearby', sub: 'No taste data', items: contrast.popular, tone: 'plain' },
    { title: `If only ${aName} chose`, sub: `${aName}'s taste alone`, items: contrast.aloneA, tone: 'a' },
    { title: `If only ${bName} chose`, sub: `${bName}'s taste alone`, items: contrast.aloneB, tone: 'b' },
    { title: 'Together', sub: 'Fair for both', items: contrast.together, tone: 'duo' },
  ] as const;

  return (
    <section className="rounded-[28px] border border-line bg-paper/90 p-5 shadow-card sm:p-6" aria-label="Would it work without Qloo?">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">Would it work without Qloo?</p>
          <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">Same street. Different tastes. Different table.</h3>
        </div>
        <p className="max-w-sm text-xs text-ink-faint">
          All four lists come from the same live Qloo data for the same neighborhood; only the taste signal changes.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map((c, ci) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: ci * 0.08 }}
            className={clsx(
              'rounded-2xl p-4',
              c.tone === 'plain' && 'bg-cream ring-1 ring-line',
              c.tone === 'a' && 'bg-a-soft/60 ring-1 ring-a/20',
              c.tone === 'b' && 'bg-b-soft/60 ring-1 ring-b/20',
              c.tone === 'duo' && 'bg-ink text-cream',
            )}
          >
            <p
              className={clsx(
                'text-sm font-semibold',
                c.tone === 'a' && 'text-a-deep',
                c.tone === 'b' && 'text-b-deep',
                c.tone === 'duo' && 'text-duo',
              )}
            >
              {c.title}
            </p>
            <p className={clsx('text-[11px]', c.tone === 'duo' ? 'text-cream/60' : 'text-ink-faint')}>{c.sub}</p>
            <ol className="mt-3 space-y-1.5">
              {c.items.map((name, i) => (
                <li key={name} className="flex items-baseline gap-2 text-sm">
                  <span className={clsx('w-4 shrink-0 tabular-nums', c.tone === 'duo' ? 'text-cream/50' : 'text-ink-faint')}>{i + 1}</span>
                  <span className="font-medium">{name}</span>
                  {c.tone === 'duo' && !popular.has(name) && (
                    <span className="ml-auto shrink-0 rounded-full bg-cream/15 px-1.5 py-0.5 text-[10px] font-semibold text-cream/80">
                      taste pick
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
