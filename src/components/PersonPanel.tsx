'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { KIND_LABEL } from '@/lib/client/format';
import type { Interest, Person } from '@/lib/taste/types';

import { TasteSearch, Thumb } from './TasteSearch';

const IDEAS: Record<'a' | 'b', string[]> = {
  a: ['Taylor Swift', 'Spirited Away', 'Gilmore Girls', 'Bad Bunny', 'Little Women'],
  b: ['Kendrick Lamar', 'Interstellar', 'The Bear', 'Radiohead', 'Succession'],
};

export function PersonPanel({
  side,
  person,
  onChange,
  locked,
  footer,
  isYou,
}: {
  isYou?: boolean;
  side: 'a' | 'b';
  person: Person;
  onChange: (p: Person) => void;
  locked?: boolean;
  footer?: React.ReactNode;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const accent = side === 'a' ? 'a' : 'b';
  const full = person.interests.length >= 8;

  const add = (i: Interest) => {
    if (person.interests.some((x) => x.id === i.id) || full) return;
    onChange({ ...person, interests: [...person.interests, i] });
  };

  const addIdea = async (name: string) => {
    setAdding(name);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
      const json = await res.json();
      const hit: Interest | undefined = json.results?.[0];
      if (hit) add(hit);
    } finally {
      setAdding(null);
    }
  };

  const ideas = IDEAS[side].filter((n) => !person.interests.some((i) => i.name.toLowerCase() === n.toLowerCase())).slice(0, 4);

  return (
    <section
      className={clsx(
        'relative flex flex-col gap-4 rounded-[28px] border bg-paper/90 p-5 shadow-card backdrop-blur sm:p-6',
        side === 'a' ? 'border-a/25' : 'border-b/25',
      )}
      aria-label={`${person.name}'s taste`}
    >
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            'grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-semibold text-white',
            side === 'a' ? 'bg-a' : 'bg-b',
          )}
          aria-hidden
        >
          {(person.name || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <label className="block text-[11px] font-semibold tracking-[0.14em] text-ink-faint uppercase" htmlFor={`name-${side}`}>
            {isYou ? 'You' : side === 'a' ? 'Person one' : 'Person two'}
          </label>
          <input
            id={`name-${side}`}
            value={person.name}
            maxLength={24}
            disabled={locked}
            onChange={(e) => onChange({ ...person, name: e.target.value })}
            className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight outline-none disabled:opacity-100"
            placeholder={isYou || side === 'a' ? 'Your name' : 'Their name'}
          />
        </div>
        <span
          className={clsx(
            'rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
            side === 'a' ? 'bg-a-soft text-a-deep' : 'bg-b-soft text-b-deep',
          )}
        >
          {person.interests.length}/8
        </span>
      </div>

      {!locked && (
        <TasteSearch
          side={side}
          onPick={add}
          disabled={full}
          placeholder={full ? "That's plenty of taste!" : 'Add an artist, film, show or book…'}
        />
      )}

      <ul className="flex min-h-[108px] flex-wrap content-start gap-2">
        <AnimatePresence initial={false}>
          {person.interests.map((i) => (
            <motion.li
              key={i.id}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={clsx(
                'group flex items-center gap-2 rounded-full border bg-cream py-1 pr-1.5 pl-1',
                side === 'a' ? 'border-a/20' : 'border-b/20',
              )}
            >
              <Thumb src={i.image} alt="" kind={i.kind} size={30} />
              <span className="max-w-[11rem] truncate text-sm font-medium">{i.name}</span>
              <span className="text-[11px] text-ink-faint">{KIND_LABEL[i.kind]}</span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onChange({ ...person, interests: person.interests.filter((x) => x.id !== i.id) })}
                  className="grid size-6 place-items-center rounded-full text-ink-faint transition hover:bg-line hover:text-ink"
                  aria-label={`Remove ${i.name}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {person.interests.length === 0 && (
          <li className="w-full rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-ink-soft">
            Add 3–5 favorites. The more different, the better — we read taste across music, film, TV and books.
          </li>
        )}
      </ul>

      {(person.beenTo?.length ?? 0) > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          <span className="font-semibold text-ink-faint uppercase tracking-wide">Been to</span>
          {person.beenTo!.map((p) => (
            <span key={p.id} className="rounded-full bg-cream px-2 py-0.5 ring-1 ring-line">
              {p.name}
            </span>
          ))}
          <span className="text-ink-faint">· we&apos;ll skip these</span>
        </p>
      )}

      {!locked && ideas.length > 0 && person.interests.length < 4 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-ink-faint">Need ideas?</span>
          {ideas.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => addIdea(n)}
              disabled={adding !== null}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:text-ink',
                accent === 'a' ? 'hover:border-a/40 hover:bg-a-soft/50' : 'hover:border-b/40 hover:bg-b-soft/50',
                adding === n && 'animate-pulse',
              )}
            >
              <Plus className="size-3" />
              {n}
            </button>
          ))}
        </div>
      )}
      {footer}
    </section>
  );
}
