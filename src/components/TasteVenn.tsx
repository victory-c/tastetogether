'use client';

import { motion } from 'motion/react';

import type { Person, TasteDna } from '@/lib/taste/types';

import { Thumb } from './TasteSearch';

function Avatars({ person }: { person: Person }) {
  return (
    <div className="flex -space-x-2">
      {person.interests.slice(0, 4).map((i) => (
        <div key={i.id} className="rounded-full ring-2 ring-paper">
          <Thumb src={i.image} alt={i.name} kind="artist" size={30} />
        </div>
      ))}
    </div>
  );
}

export function TasteVenn({ dna, a, b }: { dna?: TasteDna; a: Person; b: Person }) {
  const shared = dna?.shared ?? [];
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-line bg-paper/90 p-5 shadow-card sm:p-6">
      <p className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">Your taste overlap · via Qloo</p>
      <div className="relative mx-auto mt-3 aspect-[2/1] w-full max-w-[640px]">
        <motion.div
          initial={{ x: '-18%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 90, damping: 16 }}
          className="absolute top-0 left-0 aspect-square h-full rounded-full bg-a/15 ring-1 ring-a/30"
        />
        <motion.div
          initial={{ x: '18%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 90, damping: 16 }}
          className="absolute top-0 right-0 aspect-square h-full rounded-full bg-b/15 ring-1 ring-b/30"
        />
        <div className="absolute inset-0 grid grid-cols-[1fr_1.05fr_1fr] items-center text-center">
          <div className="flex flex-col items-center gap-2 px-2">
            <Avatars person={a} />
            <p className="font-display text-base font-semibold text-a-deep sm:text-lg">{a.name}</p>
            <div className="flex flex-wrap justify-center gap-1">
              {(dna?.a ?? []).slice(0, 3).map((t) => (
                <span key={t.id} className="rounded-full bg-paper/80 px-2 py-0.5 text-[11px] font-medium text-a-deep">
                  {t.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5 px-1">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-soft uppercase">You both love</p>
            {dna ? (
              shared.length ? (
                shared.slice(0, 4).map((t, i) => (
                  <motion.span
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.12 }}
                    className="text-duo font-display text-sm font-semibold italic sm:text-lg"
                  >
                    {t.name}
                  </motion.span>
                ))
              ) : (
                <span className="text-xs text-ink-soft">Opposites — we&apos;ll find the bridge</span>
              )
            ) : (
              <span className="skeleton h-4 w-20 rounded-full" />
            )}
          </div>
          <div className="flex flex-col items-center gap-2 px-2">
            <Avatars person={b} />
            <p className="font-display text-base font-semibold text-b-deep sm:text-lg">{b.name}</p>
            <div className="flex flex-wrap justify-center gap-1">
              {(dna?.b ?? []).slice(0, 3).map((t) => (
                <span key={t.id} className="rounded-full bg-paper/80 px-2 py-0.5 text-[11px] font-medium text-b-deep">
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
