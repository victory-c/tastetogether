"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Heart, Link2, Loader2, RotateCcw, Share2, Sparkles, Wand2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { decodePerson, encodePerson } from "@/lib/client/invite";
import { useMatch, type MatchBody } from "@/lib/client/useMatch";
import { AREAS, DEFAULT_AREA, OCCASIONS } from "@/lib/taste/occasions";
import { SAMPLE_DUOS } from "@/lib/taste/samples";
import type { Occasion, Person, Pick } from "@/lib/taste/types";

import { AgentTrace } from "./AgentTrace";
import { Celebration } from "./Celebration";
import { ContrastPanel } from "./ContrastPanel";
import { PersonPanel } from "./PersonPanel";
import { PickCard } from "./PickCard";
import { PlanControls, type Plan } from "./PlanControls";
import { SiteHeader } from "./SiteHeader";
import { TasteVenn } from "./TasteVenn";

const HISTORY_KEY = "tastetogether.history.v1";

interface HistoryItem {
  id: string;
  name: string;
  with: string;
  at: string;
}

function readHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    // Private mode: memory just won't persist.
  }
}

const EMPTY_A: Person = { name: "You", interests: [] };
const EMPTY_B: Person = { name: "Them", interests: [] };
const DEFAULT_PLAN: Plan = { occasion: "date", areaId: DEFAULT_AREA.id, priceMax: null, vibe: "", mode: "three" };

export function MatchApp() {
  const params = useSearchParams();
  const router = useRouter();
  const [a, setA] = useState<Person>(EMPTY_A);
  const [b, setB] = useState<Person>(EMPTY_B);
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [activeDuo, setActiveDuo] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [visible, setVisible] = useState<string[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Pick | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastBody, setLastBody] = useState<MatchBody | null>(null);
  const { state, run, reset } = useMatch();
  const autoRan = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Hydrate thumbnails for interests that arrived without images (samples, invite links).
  const hydrate = useCallback(async (people: Person[]) => {
    const ids = people.flatMap((p) => p.interests.filter((i) => !i.image).map((i) => i.id));
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/entities?ids=${ids.join(",")}`);
      const { images } = (await res.json()) as { images: Record<string, string> };
      const fill = (p: Person): Person => ({ ...p, interests: p.interests.map((i) => (i.image ? i : { ...i, image: images[i.id] })) });
      setA((p) => fill(p));
      setB((p) => fill(p));
    } catch {
      // Thumbnails are decorative.
    }
  }, []);

  const loadDuo = useCallback(
    (id: string) => {
      const duo = SAMPLE_DUOS.find((d) => d.id === id);
      if (!duo) return null;
      setA(duo.a);
      setB(duo.b);
      const nextPlan: Plan = { occasion: duo.occasion, areaId: duo.areaId, priceMax: duo.priceMax, vibe: duo.vibe, mode: "three" };
      setPlan(nextPlan);
      setActiveDuo(duo.id);
      setInvitedBy(null);
      reset();
      setChosen(null);
      void hydrate([duo.a, duo.b]);
      return { duo, plan: nextPlan };
    },
    [hydrate, reset],
  );

  const bodyFor = useCallback(
    (pa: Person, pb: Person, pl: Plan, exclude: string[] = []): MatchBody => {
      const remembered = history.map((h) => h.id);
      const strip = (p: Person) => ({
        name: p.name.trim() || "Friend",
        interests: p.interests.map(({ id, name, kind, year }) => ({ id, name, kind, year })),
        visited: [...new Set([...remembered, ...(p.visited ?? []), ...(p.beenTo ?? []).map((x) => x.id)])].slice(0, 50),
      });
      return {
        a: strip(pa),
        b: strip(pb),
        occasion: pl.occasion,
        priceMax: pl.priceMax,
        areaId: pl.near ? undefined : pl.areaId,
        near: pl.near,
        mode: pl.mode,
        vibe: pl.vibe.trim() || undefined,
        exclude,
      };
    },
    [history],
  );

  const start = useCallback(
    (pa: Person, pb: Person, pl: Plan, exclude: string[] = []) => {
      const body = bodyFor(pa, pb, pl, exclude);
      setLastBody(body);
      setVisible([]);
      setUsed(exclude);
      setChosen(null);
      void run(body);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    },
    [bodyFor, run],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount.
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    if (autoRan.current) return;
    const demo = params.get("demo");
    const invite = params.get("invite");
    const sa = params.get("a");
    const sb = params.get("b");
    autoRan.current = true;
    if (demo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from the URL (demo/invite/share links).
      const loaded = loadDuo(demo);
      if (loaded && params.get("go") === "1") start(loaded.duo.a, loaded.duo.b, loaded.plan);
    } else if (sa && sb) {
      const pa = decodePerson(sa);
      const pb = decodePerson(sb);
      if (pa && pb) {
        const occ = (params.get("o") as Occasion) || "date";
        const pl: Plan = {
          ...DEFAULT_PLAN,
          occasion: occ in OCCASIONS ? occ : "date",
          areaId: params.get("area") || DEFAULT_AREA.id,
          priceMax: (Number(params.get("p")) || null) as Plan["priceMax"],
          vibe: params.get("v") || "",
        };
        setA(pa);
        setB(pb);
        setPlan(pl);
        void hydrate([pa, pb]);
        if (params.get("go") === "1") start(pa, pb, pl);
      }
    } else if (invite) {
      const pa = decodePerson(invite);
      if (pa) {
        setA(pa);
        setB({ name: "", interests: [] });
        setInvitedBy(pa.name);
        void hydrate([pa]);
      }
    }
  }, [params, loadDuo, start, hydrate]);

  // Fill the visible cards as soon as results arrive.
  useEffect(() => {
    if (state.phase !== "done" || visible.length > 0) return;
    const n = plan.mode === "one" ? 1 : 3;
    const first = state.picks.slice(0, n).map((p) => p.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived once per finished run.
    setVisible(first);
    setUsed((u) => [...new Set([...u, ...first])]);
  }, [state.phase, state.picks, plan.mode, visible.length]);

  const pickById = useMemo(() => new Map(state.picks.map((p) => [p.id, p])), [state.picks]);
  const ready = a.interests.length > 0 && b.interests.length > 0;
  const showResults = state.phase !== "idle";

  const another = (id: string) => {
    const next = state.picks.find((p) => !used.includes(p.id) && !visible.includes(p.id));
    if (next) {
      setVisible((v) => v.map((x) => (x === id ? next.id : x)));
      setUsed((u) => [...u, next.id]);
      return;
    }
    // Out of local alternatives: ask the agent again, excluding everything we've already shown.
    start(a, b, plan, [...new Set([...used, ...visible])]);
  };

  const choose = (p: Pick) => {
    setChosen(p);
    setCelebrating(true);
    const item = { id: p.id, name: p.name, with: `${a.name} & ${b.name}`, at: new Date().toISOString() };
    const next = [item, ...history.filter((h) => h.id !== p.id)];
    setHistory(next);
    writeHistory(next);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2200);
    } catch {
      window.prompt("Copy this link", text);
    }
  };

  const inviteLink = () => `${window.location.origin}/match?invite=${encodePerson(a)}`;
  const shareLink = () => {
    const q = new URLSearchParams({ a: encodePerson(a), b: encodePerson(b), o: plan.occasion, area: plan.areaId, go: "1" });
    if (plan.priceMax) q.set("p", String(plan.priceMax));
    if (plan.vibe) q.set("v", plan.vibe);
    return `${window.location.origin}/match?${q.toString()}`;
  };

  return (
    <>
      <SiteHeader compact />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 sm:px-6">
        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div key="builder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
              <div className="flex flex-col gap-4 pt-6 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pt-10">
                <div>
                  {invitedBy ? (
                    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-a-soft px-3 py-1 text-xs font-semibold text-a-deep">
                      <Heart className="size-3.5" /> {invitedBy} invited you to pick a place together
                    </p>
                  ) : null}
                  <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                    {invitedBy ? (
                      <>
                        Add what <span className="text-duo italic">you</span> love.
                      </>
                    ) : (
                      <>
                        Who&apos;s <span className="text-duo italic">eating?</span>
                      </>
                    )}
                  </h1>
                  <p className="mt-2 max-w-xl text-ink-soft">
                    Pick a few artists, films, shows or books for each person. No food preferences needed — your cultural taste says more than you think.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Try a demo duo</span>
                  {SAMPLE_DUOS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => loadDuo(d.id)}
                      className={clsx(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                        activeDuo === d.id ? "border-ink bg-ink text-cream" : "border-line bg-paper hover:border-ink/30",
                      )}
                      title={d.story}
                    >
                      {d.title}
                    </button>
                  ))}
                </div>
              </div>

              {activeDuo && (
                <p className="mb-4 rounded-2xl bg-paper/80 px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
                  <Sparkles className="mr-1.5 inline size-4 text-b" />
                  <span className="font-semibold text-ink">Demo duo:</span> {SAMPLE_DUOS.find((d) => d.id === activeDuo)?.story}. These people are
                  fictional; every recommendation below is computed live from Qloo.
                </p>
              )}

              <div className="relative grid gap-4 lg:grid-cols-2 lg:gap-6">
                <PersonPanel side="a" person={a} onChange={setA} locked={Boolean(invitedBy)} />
                <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 hidden size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-paper font-display text-xl italic shadow-card ring-1 ring-line lg:grid">
                  &amp;
                </div>
                <PersonPanel
                  side="b"
                  person={b}
                  onChange={setB}
                  footer={
                    !invitedBy && a.interests.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => copy(inviteLink(), "invite")}
                        className="inline-flex items-center gap-1.5 self-start rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:text-ink"
                      >
                        <Link2 className="size-3.5" />
                        {copied === "invite" ? "Invite link copied!" : `Not together? Send ${b.name && b.name !== "Them" ? b.name : "them"} an invite link`}
                      </button>
                    ) : null
                  }
                />
              </div>

              <div className="mt-4 lg:mt-6">
                <PlanControls plan={plan} onChange={setPlan} />
              </div>

              {history.length > 0 && (
                <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">Memory:</span> skipping {history.length} place{history.length > 1 ? "s" : ""} you&apos;ve already
                  picked ({history.slice(0, 3).map((h) => h.name).join(", ")}
                  {history.length > 3 ? "…" : ""})
                  <button
                    type="button"
                    className="text-xs font-semibold underline underline-offset-2"
                    onClick={() => {
                      setHistory([]);
                      writeHistory([]);
                    }}
                  >
                    Forget
                  </button>
                </p>
              )}

              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/85 px-4 py-3 backdrop-blur-md sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <div className="mx-auto flex max-w-6xl items-center gap-3">
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => start(a, b, plan)}
                    className="bg-duo inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full px-8 text-base font-semibold text-white shadow-lift transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                  >
                    <Wand2 className="size-5" /> Find our table
                  </button>
                  <p className="hidden text-sm text-ink-soft sm:block">
                    {ready ? "Takes about 3 seconds. Every pick is scored live by Qloo." : "Add at least one favorite for each person."}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="results" ref={resultsRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-5 sm:pt-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    router.replace("/match");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-sm font-semibold transition hover:border-ink/30"
                >
                  <ArrowLeft className="size-4" /> Edit tastes
                </button>
                <div className="flex items-center gap-2">
                  {state.phase === "done" && (
                    <button
                      type="button"
                      onClick={() => copy(shareLink(), "share")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-sm font-semibold transition hover:border-ink/30"
                    >
                      <Share2 className="size-4" /> {copied === "share" ? "Link copied!" : "Share these picks"}
                    </button>
                  )}
                  {lastBody && state.phase !== "running" && (
                    <button
                      type="button"
                      onClick={() => start(a, b, plan)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-sm font-semibold transition hover:border-ink/30"
                    >
                      <RotateCcw className="size-4" /> Run again
                    </button>
                  )}
                </div>
              </div>

              <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr] lg:gap-6">
                <TasteVenn dna={state.dna} a={a} b={b} />
                <AgentTrace steps={state.steps} running={state.phase === "running"} stats={state.stats} />
              </div>

              {state.phase === "running" && (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="overflow-hidden rounded-[28px] border border-line bg-paper">
                      <div className="skeleton aspect-[16/10]" />
                      <div className="space-y-2 p-5">
                        <div className="skeleton h-3 w-1/3 rounded-full" />
                        <div className="skeleton h-6 w-2/3 rounded-full" />
                        <div className="skeleton h-3 w-full rounded-full" />
                        <div className="skeleton h-3 w-5/6 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {state.phase === "error" && state.error && (
                <div className="mt-6 rounded-[28px] border border-a/30 bg-a-soft/50 p-6">
                  <p className="font-display text-2xl font-semibold">
                    {state.error.status === "no_match" ? "No table fits every wish — yet." : "We hit a snag."}
                  </p>
                  <p className="mt-1 text-ink-soft">{state.error.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {state.error.status === "no_match" && (
                      <button
                        type="button"
                        onClick={() => {
                          const relaxedPlan = { ...plan, priceMax: null, vibe: "" };
                          setPlan(relaxedPlan);
                          start(a, b, relaxedPlan);
                        }}
                        className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-cream"
                      >
                        Drop the budget &amp; vibe filters
                      </button>
                    )}
                    <button type="button" onClick={() => start(a, b, plan)} className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-semibold">
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {state.phase === "done" && (
                <section className="mt-8" aria-live="polite">
                  <div className="mb-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">
                      {OCCASIONS[plan.occasion].emoji} {OCCASIONS[plan.occasion].label} ·{" "}
                      {plan.near ? "Near you" : AREAS.find((x) => x.id === plan.areaId)?.label}
                      {state.when ? ` · ${state.when}` : ""}
                    </p>
                    <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                      {state.headline ?? (plan.mode === "one" ? `Tonight, ${a.name} & ${b.name} eat here.` : `Three tables ${a.name} & ${b.name} will both love.`)}
                    </h2>
                    {state.relaxed && <p className="mt-2 text-sm text-ink-soft">{state.relaxed}</p>}
                    {state.pool && state.pool.skipped > 0 && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1 text-xs font-semibold text-mint">
                        Memory: skipped {state.pool.skipped} place{state.pool.skipped > 1 ? "s" : ""} {a.name} or {b.name} has already been to
                      </p>
                    )}
                  </div>

                  <div className={clsx("grid gap-5", plan.mode === "one" ? "" : "md:grid-cols-2 lg:grid-cols-3")}>
                    <AnimatePresence mode="popLayout">
                      {visible.map((id, i) => {
                        const p = pickById.get(id);
                        if (!p) return null;
                        return (
                          <PickCard
                            key={p.id}
                            pick={p}
                            index={i}
                            hero={plan.mode === "one"}
                            aName={a.name}
                            bName={b.name}
                            chosen={chosen?.id === p.id}
                            when={state.when}
                            onChoose={() => choose(p)}
                            onAnother={() => another(p.id)}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {state.contrast && (
                    <div className="mt-8">
                      <ContrastPanel aName={a.name} bName={b.name} contrast={state.contrast} />
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {state.negotiation && (
                      <div className="rounded-[24px] border border-line bg-paper/90 p-5 shadow-card">
                        <p className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">How each taste ranked the finalists</p>
                        <table className="mt-3 w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-ink-faint">
                              <th className="pb-2 font-medium">Place</th>
                              <th className="pb-2 text-right font-medium text-a-deep">{a.name}</th>
                              <th className="pb-2 text-right font-medium text-b-deep">{b.name}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.negotiation.map((r) => (
                              <tr key={r.name} className="border-t border-line/70">
                                <td className="py-2 pr-2 font-medium">{r.name}</td>
                                <td className="py-2 text-right tabular-nums">#{r.rankA}</td>
                                <td className="py-2 text-right tabular-nums">#{r.rankB}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="mt-3 text-xs text-ink-faint">
                          Out of {state.negotiation[0]?.of} places Qloo scored for both of you. We favor the spot where the less-excited person is still happy.
                        </p>
                      </div>
                    )}
                    <div className="rounded-[24px] border border-dashed border-line p-5">
                      <p className="text-xs font-semibold tracking-[0.14em] text-ink-soft uppercase">How the agent read your plan</p>
                      <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                        <li>
                          <span className="font-medium text-ink">Occasion:</span> {OCCASIONS[plan.occasion].label}, planned for {state.when?.toLowerCase()}
                          ; places that won&apos;t be open then are pushed down.
                        </li>
                        {state.vibe && (
                          <li>
                            <span className="font-medium text-ink">Your vibe → Qloo tags:</span>{" "}
                            {state.vibe.tags.length ? state.vibe.tags.map((t) => t.name).join(", ") : "no matching tags"}
                            {state.vibe.source === "keywords" ? " (keyword match)" : " (chosen by the agent from Qloo's taxonomy)"}
                          </li>
                        )}
                        {state.pool && (
                          <li>
                            <span className="font-medium text-ink">Scored:</span> {state.pool.scored} places, each scored separately for {a.name} and for {b.name}
                            {state.stats ? ` in ${state.stats.qlooCalls} live Qloo calls` : ""}.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Celebration when={state.when} pick={celebrating ? chosen : null} aName={a.name} bName={b.name} onClose={() => setCelebrating(false)} onShare={() => copy(shareLink(), "share")} copied={copied === "share"} />
      {state.phase === "running" && (
        <div className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream shadow-lift sm:hidden">
          <Loader2 className="size-4 animate-spin" /> Finding your table…
        </div>
      )}
    </>
  );
}
