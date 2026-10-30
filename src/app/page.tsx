import { ArrowRight, Check, Compass, Heart, Scale, Sparkles, X } from "lucide-react";
import Link from "next/link";

import { HeroOrbit } from "@/components/HeroOrbit";
import { LogoMark } from "@/components/Logo";
import { REPO_URL, SiteHeader } from "@/components/SiteHeader";

const STEPS = [
  {
    icon: Heart,
    title: "Tell us what you love",
    body: "A few artists, films, shows or books each. No food quiz — cultural taste predicts where you'll feel at home.",
    api: "/search",
  },
  {
    icon: Sparkles,
    title: "Qloo maps your taste DNA",
    body: "The agent compares both profiles to find what you share — and what makes each of you different.",
    api: "/v2/analysis/compare",
  },
  {
    icon: Compass,
    title: "Every spot, scored for each of you",
    body: "Nearby restaurants are scouted through each person's taste, then every candidate is scored for both people.",
    api: "/v2/insights · filter.results.entities",
  },
  {
    icon: Scale,
    title: "A fair pick, explained",
    body: "We remove the popularity effect and choose where the less-excited person is still happy. Every reason traces to Qloo.",
    api: "feature.explainability",
  },
];

const COMPARE = [
  ["Ranks what's popular", "Ranks what fits both of your tastes"],
  ["Optimizes for one person's query", "Scores every spot for each person, then finds the fair middle"],
  ["Can invent hours, dishes or vibes", "Venue facts come from Qloo data; unknowns are labeled"],
  ["Forgets where you've been", "Remembers your picks and skips them next time"],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-paper/80 px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line">
              <span className="size-1.5 rounded-full bg-mint" /> A dining agent built on Qloo&apos;s taste graph
            </p>
            <h1 className="mt-5 font-display text-[3.4rem] leading-[0.95] font-semibold tracking-[-0.03em] text-balance sm:text-7xl">
              Two tastes.
              <br />
              <span className="text-duo italic">One table.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Tell us the music, films and shows you each love. Our agent reads both tastes through Qloo&apos;s cultural graph and finds the place you&apos;ll{" "}
              <em className="font-semibold text-ink not-italic">both</em> love — in about three seconds.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/match?demo=maya-leo&go=1"
                className="bg-duo inline-flex h-14 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold whitespace-nowrap text-white shadow-lift transition hover:brightness-110"
              >
                Watch a live demo <ArrowRight className="size-5" />
              </Link>
              <Link
                href="/match"
                className="inline-flex h-14 items-center justify-center rounded-full border border-ink/15 bg-paper px-6 text-base font-semibold whitespace-nowrap transition hover:border-ink/40"
              >
                Use your own taste
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
              {["No sign-up", "Live Qloo scoring", "Fair to both people"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-mint" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroOrbit />
        </section>

        <section className="border-y border-line/70 bg-paper/60">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <p className="font-display text-3xl leading-snug font-medium tracking-tight text-balance italic sm:text-4xl">
              &ldquo;Where do you want to eat?&rdquo;
              <br />
              <span className="text-ink-soft">&ldquo;I don&apos;t know… you pick.&rdquo;</span>
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-soft">
              Review apps rank what&apos;s popular. AI chatbots guess. Neither knows that a <span className="font-semibold text-a-deep">Gilmore Girls</span> fan
              and a <span className="font-semibold text-b-deep">Dune</span> obsessive might share a soft spot for the same candlelit dining room.{" "}
              <span className="font-semibold text-ink">Qloo does</span> — its graph links 250M+ cultural entities to real places.
            </p>
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-ink-soft uppercase">How the agent works</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Four steps, all visible, all real.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-[28px] border border-line bg-paper p-6 shadow-card">
                <span className="font-display text-5xl font-semibold text-line">{i + 1}</span>
                <s.icon className="absolute top-6 right-6 size-6 text-b" />
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                <p className="mt-4 inline-block rounded-lg bg-cream px-2 py-1 font-mono text-[11px] text-ink-soft ring-1 ring-line">{s.api}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-[32px] border border-line bg-paper shadow-card">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-line p-7 md:border-r md:border-b-0 sm:p-9">
                <p className="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase">Generic lists &amp; chatbots</p>
                <ul className="mt-5 space-y-4">
                  {COMPARE.map(([bad]) => (
                    <li key={bad} className="flex items-start gap-3 text-ink-soft">
                      <X className="mt-0.5 size-5 shrink-0 text-ink-faint" /> {bad}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative p-7 sm:p-9">
                <p className="text-duo text-xs font-semibold tracking-[0.16em] uppercase">TasteTogether</p>
                <ul className="mt-5 space-y-4">
                  {COMPARE.map(([, good]) => (
                    <li key={good} className="flex items-start gap-3 font-medium">
                      <Check className="mt-0.5 size-5 shrink-0 text-mint" strokeWidth={3} /> {good}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <div className="bg-duo relative overflow-hidden rounded-[36px] px-7 py-14 text-center text-white shadow-lift sm:px-12">
            <h2 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Settle tonight&apos;s dinner debate.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Try a demo duo in one click, or send a friend an invite link and each add your own taste.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/match?demo=maya-leo&go=1" className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-white px-7 font-semibold text-ink">
                Run the demo <ArrowRight className="size-4" />
              </Link>
              <Link href="/match" className="inline-flex h-13 items-center justify-center rounded-full px-7 font-semibold ring-1 ring-white/60 transition hover:bg-white/10">
                Use our own tastes
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <LogoMark size={20} /> Built for the Qloo Agentic Hackathon. Taste intelligence by Qloo.
          </p>
          <p className="flex gap-4">
            <a href={REPO_URL} className="hover:text-ink" target="_blank" rel="noreferrer">
              Source (MIT)
            </a>
            <Link href="/match" className="hover:text-ink">
              Open the app
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}
