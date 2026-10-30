'use client';

import { useCallback, useRef, useState } from 'react';

import type { MatchEvent, Pick, StepEvent, TasteDna, TasteTag } from '../taste/types';

export interface MatchBody {
  a: { name: string; interests: { id: string; name: string; kind: string; year?: number }[]; visited?: string[] };
  b: { name: string; interests: { id: string; name: string; kind: string; year?: number }[]; visited?: string[] };
  occasion: string;
  priceMax: number | null;
  areaId?: string;
  near?: { lat: number; lon: number };
  mode: 'three' | 'one';
  vibe?: string;
  exclude?: string[];
  show?: { venueId: string; doors: number; performer?: { id: string; name: string; kind: string; year?: number } };
}

export interface MatchState {
  phase: 'idle' | 'running' | 'done' | 'error';
  steps: StepEvent[];
  dna?: TasteDna;
  vibe?: { tags: TasteTag[]; source: 'agent' | 'keywords' };
  pool?: { scored: number; popularBaseline: string[]; skipped: number };
  contrast?: { popular: string[]; aloneA: string[]; aloneB: string[]; together: string[] };
  when?: string;
  negotiation?: { name: string; rankA: number; rankB: number; of: number }[];
  picks: Pick[];
  headline?: string;
  relaxed?: string;
  stats?: { qlooCalls: number; cached: number; ms: number; llm: string | null };
  error?: { status: string; message: string };
}

const initial: MatchState = { phase: 'idle', steps: [], picks: [] };

/** Real events can arrive faster than a person can read them; space step updates out a little on screen. */
const STEP_GAP_MS = 260;

export function useMatch() {
  const [state, setState] = useState<MatchState>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<MatchEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyNow = useCallback((e: MatchEvent) => {
    setState((s) => {
      switch (e.type) {
        case 'step': {
          const idx = s.steps.findIndex((x) => x.id === e.id);
          const steps = idx === -1 ? [...s.steps, e] : s.steps.map((x, i) => (i === idx ? e : x));
          return { ...s, steps };
        }
        case 'dna':
          return { ...s, dna: e.dna };
        case 'vibe':
          return { ...s, vibe: { tags: e.tags, source: e.source } };
        case 'pool':
          return { ...s, pool: { scored: e.scored, popularBaseline: e.popularBaseline, skipped: e.skipped } };
        case 'contrast':
          return { ...s, contrast: { popular: e.popular, aloneA: e.aloneA, aloneB: e.aloneB, together: e.together } };
        case 'negotiation':
          return { ...s, negotiation: e.rows };
        case 'result':
          return { ...s, phase: 'done', picks: e.picks, headline: e.headline, relaxed: e.relaxed, stats: e.stats, when: e.when };
        case 'error':
          return { ...s, phase: 'error', error: { status: e.status, message: e.message } };
      }
    });
  }, []);

  const drain = useCallback(() => {
    timerRef.current = null;
    const next = queueRef.current.shift();
    if (!next) return;
    applyNow(next);
    const wait = next.type === 'step' && next.status === 'done' ? STEP_GAP_MS : 0;
    timerRef.current = setTimeout(drain, wait);
  }, [applyNow]);

  const apply = useCallback(
    (e: MatchEvent) => {
      queueRef.current.push(e);
      if (!timerRef.current) drain();
    },
    [drain],
  );

  const clearQueue = () => {
    queueRef.current = [];
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const run = useCallback(
    async (body: MatchBody) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      clearQueue();
      setState({ ...initial, phase: 'running' });
      try {
        const res = await fetch('/api/match', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const msg = await res.json().catch(() => ({ error: 'Something went wrong.' }));
          apply({ type: 'error', status: 'provider_unavailable', message: msg.error ?? 'Something went wrong.' });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl = buf.indexOf('\n');
          while (nl !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) apply(JSON.parse(line) as MatchEvent);
            nl = buf.indexOf('\n');
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        apply({ type: 'error', status: 'provider_unavailable', message: 'We lost the connection. Please try again.' });
      }
    },
    [apply],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearQueue();
    setState(initial);
  }, []);

  return { state, run, reset };
}
