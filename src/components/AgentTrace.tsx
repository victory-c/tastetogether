'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';

import type { StepEvent } from '@/lib/taste/types';

const PLANNED = [
  { id: 'dna', label: 'Mapping where your tastes overlap' },
  { id: 'scout', label: "Scouting restaurants through each person's taste" },
  { id: 'score', label: 'Scoring every spot for both of you' },
  { id: 'negotiate', label: 'Negotiating the fairest table' },
  { id: 'explain', label: 'Writing why each pick works' },
];

export function AgentTrace({
  steps,
  running,
  stats,
  compact,
}: {
  steps: StepEvent[];
  running: boolean;
  stats?: { qlooCalls: number; cached: number; ms: number; llm: string | null };
  compact?: boolean;
}) {
  const ids = new Set(steps.map((s) => s.id));
  const pending = running ? PLANNED.filter((p) => !ids.has(p.id) && !(p.id === 'vibe')) : [];

  return (
    <div className={clsx('rounded-[24px] border border-line bg-paper/90 shadow-card backdrop-blur', compact ? 'p-4' : 'p-5')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">
          <span className={clsx('size-2 rounded-full', running ? 'animate-pulse bg-mint' : 'bg-ink-faint')} />
          {running ? 'Agent at work' : 'What the agent did'}
        </p>
        {stats && (
          <p className="text-xs text-ink-faint tabular-nums">
            {stats.qlooCalls + stats.cached} Qloo calls{stats.cached ? ` (${stats.cached} from cache)` : ''} ·{' '}
            {(stats.ms / 1000).toFixed(1)}s
          </p>
        )}
      </div>
      <ol className="space-y-2.5">
        <AnimatePresence initial={false}>
          {steps.map((s) => (
            <motion.li key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3">
              <span
                className={clsx(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                  s.status === 'done' ? 'bg-mint text-white' : 'bg-mint-soft text-mint',
                )}
              >
                {s.status === 'done' ? <Check className="size-3" strokeWidth={3} /> : <Loader2 className="size-3 animate-spin" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                {s.detail && <p className="text-xs text-ink-soft">{s.detail}</p>}
              </div>
              {s.ms !== undefined && <span className="text-[11px] text-ink-faint tabular-nums">{s.ms < 1 ? '<1' : s.ms}ms</span>}
            </motion.li>
          ))}
          {pending.map((p) => (
            <motion.li key={`p-${p.id}`} className="flex items-start gap-3 opacity-40">
              <span className="mt-0.5 size-5 shrink-0 rounded-full border border-dashed border-ink-faint" />
              <p className="text-sm">{p.label}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
