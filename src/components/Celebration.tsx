'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Share2, X } from 'lucide-react';
import { useEffect } from 'react';

import { openLabel } from '@/lib/client/format';
import type { Pick } from '@/lib/taste/types';

const CONFETTI = Array.from({ length: 28 }, (_, i) => i);
const COLORS = ['var(--color-a)', 'var(--color-b)', '#c447b8', 'var(--color-amber)', 'var(--color-mint)'];

export function Celebration({
  pick,
  aName,
  bName,
  onClose,
  onShare,
  copied,
  when,
}: {
  when?: string;
  pick: Pick | null;
  aName: string;
  bName: string;
  onClose: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, onClose]);

  return (
    <AnimatePresence>
      {pick && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Plan: ${pick.name}`}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {CONFETTI.map((i) => (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 block size-2.5 rounded-[3px]"
                style={{ background: COLORS[i % COLORS.length] }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{
                  x: Math.cos((i / CONFETTI.length) * Math.PI * 2) * (180 + (i % 5) * 40),
                  y: Math.sin((i / CONFETTI.length) * Math.PI * 2) * (140 + (i % 4) * 40) + 120,
                  opacity: 0,
                  rotate: 360,
                }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
              />
            ))}
          </div>
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-paper shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/9] bg-line">
              {pick.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pick.image} alt="" className="absolute inset-0 size-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-paper/90 text-ink"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
              <div className="absolute bottom-4 left-5 text-cream">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-80">It&apos;s a plan</p>
                <p className="font-display text-3xl font-semibold">{pick.name}</p>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-ink-soft">
                <span className="font-semibold text-a-deep">{aName}</span> &amp; <span className="font-semibold text-b-deep">{bName}</span>{' '}
                — we saved this to your memory, so we won&apos;t suggest it again next time.
              </p>
              <p className="text-sm text-ink-soft">
                {openLabel(pick.open, when).text}. Hours come from Qloo; double-check before you head out.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={pick.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-duo inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Get directions <ArrowUpRight className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={onShare}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-sm font-semibold"
                >
                  <Share2 className="size-4" /> {copied ? 'Link copied!' : 'Send to ' + bName}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
