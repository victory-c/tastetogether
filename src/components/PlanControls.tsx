"use client";

import clsx from "clsx";
import { LocateFixed, MapPin, Sparkles } from "lucide-react";

import { AREAS, DEFAULT_AREA, OCCASIONS } from "@/lib/taste/occasions";
import type { DecisionMode, Occasion } from "@/lib/taste/types";

export interface Plan {
  occasion: Occasion;
  areaId: string;
  near?: { lat: number; lon: number };
  priceMax: 1 | 2 | 3 | 4 | null;
  vibe: string;
  mode: DecisionMode;
}

const PRICES: { v: Plan["priceMax"]; label: string }[] = [
  { v: 1, label: "$" },
  { v: 2, label: "$$" },
  { v: 3, label: "$$$" },
  { v: null, label: "Any" },
];

export function PlanControls({ plan, onChange }: { plan: Plan; onChange: (p: Plan) => void }) {
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => onChange({ ...plan, [k]: v });

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ ...plan, areaId: "near-me", near: { lat: pos.coords.latitude, lon: pos.coords.longitude } }),
      () => onChange({ ...plan, near: undefined, areaId: DEFAULT_AREA.id }),
      { timeout: 8000, maximumAge: 600_000 },
    );
  };

  return (
    <section className="rounded-[28px] border border-line bg-paper/90 p-5 shadow-card backdrop-blur sm:p-6" aria-label="The plan">
      <h2 className="font-display text-xl font-semibold tracking-tight">What&apos;s the plan?</h2>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Occasion">
        {(Object.keys(OCCASIONS) as Occasion[]).map((k) => {
          const o = OCCASIONS[k];
          const on = plan.occasion === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set("occasion", k)}
              className={clsx(
                "rounded-2xl border px-3.5 py-3 text-left transition",
                on ? "border-ink bg-ink text-cream shadow-card" : "border-line bg-cream/60 hover:border-ink/30",
              )}
            >
              <span className="text-lg" aria-hidden>
                {o.emoji}
              </span>
              <span className="mt-1 block text-sm font-semibold">{o.label}</span>
              <span className={clsx("block text-xs", on ? "text-cream/70" : "text-ink-soft")}>{o.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase" htmlFor="area">
            <MapPin className="size-3.5" /> Meet around
          </label>
          <div className="flex gap-2">
            <select
              id="area"
              value={plan.near ? "near-me" : plan.areaId}
              onChange={(e) => onChange({ ...plan, areaId: e.target.value, near: undefined })}
              className="w-full appearance-none rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-sm font-medium outline-none focus:border-ink/40"
            >
              {plan.near && <option value="near-me">📍 Near me</option>}
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={locate}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition hover:border-ink/30 hover:text-ink"
              title="Use my location"
            >
              <LocateFixed className="size-4" />
              <span className="hidden sm:inline">Near me</span>
            </button>
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-soft uppercase">Budget</span>
          <div className="flex rounded-xl border border-line bg-cream/60 p-1" role="radiogroup" aria-label="Budget">
            {PRICES.map((p) => (
              <button
                key={p.label}
                type="button"
                role="radio"
                aria-checked={plan.priceMax === p.v}
                onClick={() => set("priceMax", p.v)}
                className={clsx(
                  "flex-1 rounded-lg py-1.5 text-sm font-semibold transition",
                  plan.priceMax === p.v ? "bg-paper text-ink shadow-card" : "text-ink-soft hover:text-ink",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase" htmlFor="vibe">
          <Sparkles className="size-3.5" /> Anything else?
        </label>
        <input
          id="vibe"
          value={plan.vibe}
          maxLength={160}
          onChange={(e) => set("vibe", e.target.value)}
          placeholder="e.g. cozy, not too loud, vegetarian-friendly"
          className="w-full rounded-xl border border-line bg-cream/60 px-3.5 py-2.5 text-[15px] outline-none placeholder:text-ink-faint focus:border-ink/40"
        />
        <p className="mt-1.5 text-xs text-ink-faint">The agent translates this into real Qloo place tags before it searches.</p>
      </div>

      <div className="mt-5 flex rounded-2xl border border-line bg-cream/60 p-1" role="radiogroup" aria-label="Decision mode">
        {(
          [
            { v: "three", label: "Show me 3 options" },
            { v: "one", label: "Pick one for us" },
          ] as const
        ).map((m) => (
          <button
            key={m.v}
            type="button"
            role="radio"
            aria-checked={plan.mode === m.v}
            onClick={() => set("mode", m.v)}
            className={clsx(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
              plan.mode === m.v ? "bg-paper text-ink shadow-card" : "text-ink-soft hover:text-ink",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </section>
  );
}
