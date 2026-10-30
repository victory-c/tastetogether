# Devpost submission draft — TasteTogether

**Tagline:** Two tastes. One table. An AI dining agent that finds where two people's tastes meet.

**Demo:** https://tastetogether.vercel.app · **Code:** https://github.com/victory-c/tastetogether (MIT)

## Inspiration

"Where do you want to eat?" "I don't know, you pick." Every couple, roommate pair and pair of friends has this conversation. Review apps rank what's popular. Chatbots guess. Neither knows that a *Gilmore Girls* fan and a *Dune* obsessive might both love the same dining room. Qloo's taste graph does.

## What it does

Each person adds a few artists, films, TV shows or books they love — no food quiz. TasteTogether's agent:

1. maps the pair's **taste DNA** (what they share, what's distinct) with Qloo's `/v2/analysis/compare`;
2. scouts nearby restaurants through **each person's taste** plus a no-taste baseline (`/v2/insights` with a WKT location and radius);
3. **scores every candidate for each person separately** (`filter.results.entities` + `feature.explainability`);
4. removes the popularity effect and **negotiates the fairest pick** — the place where the less-excited person is still happy;
5. explains each pick with facts only: both people's rank among all scored places, the favorite that most shaped it (only when Qloo's explainability says one stands out), Qloo occasion tags, noise level, signature dishes and open status at the planned time.

Occasions change the answer: date night, catch-up, work meal, coffee — and **Before a show**, where you pick a venue (Greek Theatre, UC Theatre, Fox Oakland…) and doors time, and the agent finds dinner nearby that's open ~1h45m before doors. Memory skips places either person has been to. Results come as three options or "Pick one for us", with instant "Try another", share links and invite links so a friend can add their taste from their own phone.

The same agent is an **MCP server** (`/api/mcp`, tools `find_table_for_two` and `taste_overlap`), so Claude, ChatGPT or any MCP client can plan dinner with it.

## Why it only works with Qloo

The inputs are cultural tastes, not cuisines. Without Qloo there are no candidates, no per-person scores, no shared taste, no attributions. Every result page includes **"Would it work without Qloo?"**: the same neighborhood ranked by popularity only, by each person alone, and together — so you can see the taste signal change the answer.

## How we built it

Next.js 16 on Vercel, TypeScript, Tailwind, Motion. The agent run is a streaming async generator: every step the UI shows is a real step (NDJSON events). An AI SDK `ToolLoopAgent` translates a free-text vibe ("cozy, not too loud") into real Qloo tags by searching `/v2/tags` in one parallel step while scouting runs; it may only choose tags the tool returned. Explanations are written from a facts-only JSON and stream in after the picks, so the LLM never delays the result; deterministic templates are the fallback. Ranking is transparent and unit-tested: per-person z-scores on a shared pool, popularity regressed out, `0.6·min + 0.2·mean + occasion + rating`. Saved profiles and two-phone rooms use Turso with signed anonymous sessions.

## Challenges

Probing the live API changed the design. `filter.location.query=Berkeley, CA` resolved to Berkeley County, **South Carolina**, so we always pass coordinates. The restaurant genre tag also returns theatres and cafés, so we filter on `primary_genre`. Most importantly, raw affinities are popularity-dominated and not comparable between people — a naive "min of both scores" just returns the most popular places. Scoring both people on one shared pool and regressing out popularity is what made the picks genuinely personal.

## What we're proud of

A pick you can trust: every number and tag on a card traces to Qloo data, unknown hours say "unverified", and the app never invents wait times or prices. And it's fast: about six Qloo calls; picks typically appear in 1–5 seconds and the written explanations follow a few seconds later.

## What's next

Ticketing and venue partners ("make it a night" after a ticket purchase), reservations from an authorized booking partner, groups larger than two, and post-meal feedback that tunes each person's profile.

## Testing instructions for judges

No login. Open the demo → **Watch a live demo** (Maya & Leo, fictional people with real Qloo favorites). Try **Jess & Marco** for *Before a show*, or replace any favorite with your own and press **Find our table**. For MCP, point a client at `https://tastetogether.vercel.app/api/mcp`.

**Built with:** qloo, next.js, typescript, vercel, ai-sdk, anthropic, tailwindcss, turso, mcp
