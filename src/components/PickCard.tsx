"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowUpRight, Check, ChevronDown, Footprints, MapPin, RefreshCw, Utensils, Volume2 } from "lucide-react";
import { useState } from "react";

import { KIND_EMOJI, openLabel, ordinalFit, price, walkMinutes } from "@/lib/client/format";
import type { PersonFit, Pick } from "@/lib/taste/types";

function FitMeter({ side, name, fit }: { side: "a" | "b"; name: string; fit: PersonFit }) {
  const pct = Math.max(6, Math.round((1 - (fit.rank - 1) / Math.max(fit.of - 1, 1)) * 100));
  const top = fit.drivers[0];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={clsx("font-semibold", side === "a" ? "text-a-deep" : "text-b-deep")}>{name}</span>
        <span className="text-xs text-ink-soft tabular-nums">
          #{fit.rank} of {fit.of} · {ordinalFit(fit.rank, fit.of)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line/70">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className={clsx("h-full rounded-full", side === "a" ? "bg-a" : "bg-b")}
        />
      </div>
      <p className="mt-1.5 truncate text-xs text-ink-soft">
        {top ? (
          <>
            Most shaped by <span className="font-medium text-ink">{KIND_EMOJI[top.kind]} {top.name}</span>
          </>
        ) : (
          <>Broad match across {name}&apos;s favorites</>
        )}
      </p>
    </div>
  );
}

function OpenBadge({ pick, when }: { pick: Pick; when?: string }) {
  const o = openLabel(pick.open, when);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur",
        o.tone === "good" && "bg-mint/90 text-white",
        o.tone === "wait" && "bg-paper/90 text-ink",
        o.tone === "bad" && "bg-ink/80 text-cream",
        o.tone === "unknown" && "bg-paper/80 text-ink-soft",
      )}
    >
      <span className={clsx("size-1.5 rounded-full", o.tone === "good" ? "bg-white" : o.tone === "bad" ? "bg-a" : "bg-amber")} />
      {o.text}
    </span>
  );
}

export function PickCard({
  pick,
  aName,
  bName,
  hero,
  index,
  onAnother,
  onChoose,
  chosen,
  when,
}: {
  when?: string;
  pick: Pick;
  aName: string;
  bName: string;
  hero?: boolean;
  index: number;
  onAnother?: () => void;
  onChoose: () => void;
  chosen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const walk = walkMinutes(pick.distanceM);
  const chips = [...new Set([...pick.matchedVibe, ...pick.occasionTags])].slice(0, 3);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 160, damping: 22, delay: index * 0.08 }}
      className={clsx(
        "group relative flex overflow-hidden rounded-[28px] border bg-paper shadow-card",
        chosen ? "border-mint ring-4 ring-mint/20" : "border-line",
        hero ? "flex-col md:flex-row" : "flex-col",
      )}
    >
      <div className={clsx("relative shrink-0 overflow-hidden bg-line", hero ? "aspect-[4/3] md:aspect-auto md:w-[44%]" : "aspect-[16/10]")}>
        {pick.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.image} alt={pick.name} className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className="bg-duo absolute inset-0 opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {hero && <span className="bg-duo rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow">Fairest pick for you both</span>}
          {!hero && index === 0 && <span className="bg-duo rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow">Best match</span>}
        </div>
        <div className="absolute right-3 bottom-3 left-3 flex flex-wrap items-center gap-1.5">
          <OpenBadge pick={pick} when={when} />
          {walk && (
            <span className="inline-flex items-center gap-1 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur">
              <Footprints className="size-3" /> {walk} min walk
            </span>
          )}
        </div>
      </div>

      <div className={clsx("flex min-w-0 flex-1 flex-col", hero ? "gap-4 p-6 sm:p-7" : "gap-3.5 p-5")}>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            {[pick.cuisine, price(pick.priceLevel), pick.rating ? `★ ${pick.rating.toFixed(1)}` : null].filter(Boolean).join(" · ")}
          </p>
          <h3 className={clsx("font-display font-semibold tracking-tight", hero ? "mt-1 text-3xl sm:text-4xl" : "mt-0.5 text-2xl")}>{pick.name}</h3>
          {pick.address && (
            <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
              <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{pick.address}</span>
            </p>
          )}
        </div>

        {pick.why && <p className={clsx("leading-relaxed text-ink", hero ? "text-[17px]" : "text-[15px]")}>{pick.why}</p>}

        <div className={clsx("grid gap-3", hero ? "sm:grid-cols-2" : "")}>
          <FitMeter side="a" name={aName} fit={pick.fitA} />
          <FitMeter side="b" name={bName} fit={pick.fitB} />
        </div>

        {(chips.length > 0 || pick.noise) && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-xs font-semibold text-mint">
                <Check className="size-3" strokeWidth={3} /> {c}
              </span>
            ))}
            {pick.noise && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line">
                <Volume2 className="size-3" /> {pick.noise}
              </span>
            )}
          </div>
        )}

        {pick.dishes.length > 0 && (
          <p className="flex items-start gap-1.5 text-sm text-ink-soft">
            <Utensils className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Known for <span className="font-medium text-ink">{pick.dishes.slice(0, hero ? 3 : 2).join(", ")}</span>
            </span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onChoose}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition",
              chosen ? "bg-mint text-white" : "bg-ink text-cream hover:bg-ink/85",
            )}
          >
            <Check className="size-4" /> {chosen ? "It's a plan!" : "Let's go here"}
          </button>
          {onAnother && (
            <button
              type="button"
              onClick={onAnother}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/30"
            >
              <RefreshCw className="size-4" /> Try another
            </button>
          )}
          <a
            href={pick.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:text-ink"
          >
            Directions <ArrowUpRight className="size-3.5" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 self-start text-xs font-semibold text-ink-faint transition hover:text-ink-soft"
          aria-expanded={open}
        >
          Why we trust this pick <ChevronDown className={clsx("size-3.5 transition", open && "rotate-180")} />
        </button>
        {open && (
          <div className="rounded-2xl bg-cream/80 p-4 text-xs leading-relaxed text-ink-soft ring-1 ring-line">
            <p>
              <span className="font-semibold text-ink">Qloo taste signals.</span> We asked Qloo to score every candidate for {aName}&apos;s and{" "}
              {bName}&apos;s favorites separately, then removed the popularity effect so a famous spot can&apos;t win by default.
            </p>
            {[
              { n: aName, f: pick.fitA },
              { n: bName, f: pick.fitB },
            ].map(({ n, f }) => (
              <p key={n} className="mt-2">
                <span className="font-semibold text-ink">{n}:</span> ranks #{f.rank} of {f.of}.{" "}
                {f.drivers.length
                  ? `Qloo's explainability credits ${f.drivers.map((d) => `${d.name} (${Math.round(d.share * 100)}%)`).join(", ")} more than usual for this place.`
                  : "No single favorite stands out; it fits their profile as a whole."}
              </p>
            ))}
            <p className="mt-2">
              <span className="font-semibold text-ink">Venue facts</span> (cuisine, price level, hours, tags, dishes) come from Qloo&apos;s place data.
              We never invent wait times or prices.
            </p>
            {pick.website && (
              <a href={pick.website} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-ink">
                Official website <ArrowUpRight className="size-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
