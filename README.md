# TasteTogether — two tastes, one table

TasteTogether is a dining agent for two people. Each person adds a few artists, films, shows or books they love — no food quiz. The agent reads both tastes through [Qloo](https://qloo.com)'s cultural taste graph, scores every nearby restaurant **for each person separately**, and picks the place where the less-excited person is still happy. Every reason it gives traces back to Qloo data.

> “Where do you want to eat?” — “I don't know, you pick.”
> Review apps rank what is popular. Chatbots guess. TasteTogether ranks what fits **both** of you.

**Live demo:** https://tastetogether.vercel.app — click **Watch a live demo** (no sign-up). Built for the Qloo Agentic Hackathon; see [What was built during the hackathon](#what-was-built-during-the-hackathon).

## 60-second judge test

1. Open the demo and click **Watch a live demo**. Maya (Taylor Swift, *Pride & Prejudice*, *Gilmore Girls*, Phoebe Bridgers) and Leo (Kendrick Lamar, *Dune: Part Two*, *The Bear*, Frank Ocean) are fictional; every result is computed live from Qloo.
2. Watch the agent trace: taste overlap → vibe → scouting → scoring every spot for both people → negotiation → explanation.
3. Scroll to **Would it work without Qloo?** — the same neighborhood ranked by popularity only, by Maya alone, by Leo alone, and together.
4. Try **Jess & Marco** for *Before a show* (dinner near the Greek Theatre before Hozier), or replace any favorite with your own and press **Find our table**.

## What it does

- **Cross-domain taste in, real restaurants out.** Favorites are resolved to Qloo entities with live search (music, film, TV, books).
- **Taste DNA.** `/v2/analysis/compare` shows what the two of you share and what is distinct to each, drawn as a Venn diagram.
- **Fair for both.** Every candidate is scored separately for each person, popularity is regressed out, and the pick must work for the less-excited person.
- **Occasions that change the answer.** Date night, catch-up, work meal, coffee, and **Before a show** (pick a venue and doors time; dinner is planned ~1h45m before doors and must be open then).
- **Honest explanations.** Each card shows both people's rank among all scored places, which favorite most shaped the pick (only when Qloo's explainability says one stands out — otherwise “broad match”), Qloo occasion tags, noise level, signature dishes, open status at the planned time, and walk time.
- **Memory.** Places either person has been to are skipped (“Memory: skipped 4 places…”), and **Let's go here** saves the pick so it is not suggested again.
- **Decide fast.** Three options or **Pick one for us**, instant **Try another**, shareable result links, and invite links so a friend can add their own taste from their phone.
- **Works inside other agents.** The same agent is exposed as an MCP server (`/api/mcp`), so Claude, ChatGPT or any MCP client can call `find_table_for_two`.

## Why it only works with Qloo

The input is cultural taste, not cuisine preferences. Knowing that a *Pride & Prejudice* fan and a *Dune* fan will both enjoy the same dining room is exactly the cross-domain signal an LLM alone does not have. Without Qloo there are no candidates, no per-person scores, no taste overlap and no attributions — the app would have nothing to rank. The in-app **Would it work without Qloo?** panel shows the difference on every run.

## How we use Qloo

| Qloo endpoint / parameter | What the agent uses it for | Code |
| --- | --- | --- |
| `GET /search` (artist, movie, tv_show, book) | Autocomplete that resolves favorites to Qloo entity IDs; MCP name resolution | [`api/search/route.ts`](src/app/api/search/route.ts), [`taste/resolve.ts`](src/lib/taste/resolve.ts) |
| `GET /v2/analysis/compare` | Taste DNA: shared vs. distinct tags for the two people | [`taste/engine.ts`](src/lib/taste/engine.ts) |
| `GET /v2/tags` | Agent tool: turns a free-text vibe into real Qloo place tags | [`agent/llm.ts`](src/lib/agent/llm.ts) |
| `GET /v2/insights` with `filter.type=urn:entity:place`, `filter.location` (WKT point + radius), `filter.tags`, `filter.price_level.max`, `filter.exclude.entities` | Scouting from three angles: person A's taste, person B's taste and a no-taste baseline; skips visited places | [`taste/engine.ts`](src/lib/taste/engine.ts) |
| `GET /v2/insights` with `filter.results.entities` + `feature.explainability=true` | Cross-scoring: Qloo scores **every** candidate for **each** person and attributes the score to their favorites | [`taste/engine.ts`](src/lib/taste/engine.ts) |
| Place properties: `primary_genre`, `hours`, `price_level`, `business_rating`, `specialty_dishes`, `good_for`, tags, `image`, `location` | Meal vs. café filtering, open-at-plan-time status, card facts, noise, photos, walk time | [`taste/occasions.ts`](src/lib/taste/occasions.ts), [`taste/hours.ts`](src/lib/taste/hours.ts) |
| `GET /entities` | Thumbnails for sample duos and shared links | [`api/entities/route.ts`](src/app/api/entities/route.ts) |

A full match makes about 6 live Qloo calls. Picks usually appear in about a second, or in about 4–6 seconds when a free-text vibe goes through the LLM tag agent (instant if the same vibe ran in the last 30 minutes); LLM-written explanations stream in a few seconds after the picks. Responses are cached privately in server memory only. **No Qloo response data is stored in this repository** (test fixtures are synthetic).

Lessons from probing the live API that shaped the design:

- `filter.location.query=Berkeley, CA` resolves to Berkeley County, **South Carolina**; the app always uses a WKT point and radius.
- The restaurant genre tag also returns theatres, cafés and bakeries; the app filters on `primary_genre`.
- Raw affinities are popularity-dominated and not comparable across people (one person's scores ran ~0.05 higher across the board), which is why ranking normalizes per person on a shared pool.

## The agent

The match is an agent run ([`runMatch`](src/lib/taste/engine.ts)) that streams real events (NDJSON) to the UI:

```
favorites A ─┐                                  ┌─ /v2/insights (A's taste) ──┐
             ├─ /v2/analysis/compare (taste DNA) ├─ /v2/insights (B's taste) ──┼─ shared pool ─ /v2/insights × 2 ─ fair rank ─ explain
favorites B ─┘                                  └─ /v2/insights (baseline) ───┘   (occasion,    filter.results    rank.ts     LLM from facts
free-text vibe ─ LLM tool loop over /v2/tags ─ boost / avoid tags                  memory,       .entities +                   or templates
                                                                                    price)        explainability
```

- **Personal agents + coordinator.** Each person's taste is scouted and scored separately (the “personal agents”); the coordinator merges a shared pool, negotiates the fair pick and explains it. The UI shows how each taste ranked the finalists.
- **Tool use.** A `ToolLoopAgent` (Vercel AI SDK) searches Qloo's tag taxonomy (all searches in one parallel step) and may only choose tags the tool returned. Restaurant scouting starts while it thinks, so the agent costs one model round trip, not the whole pipeline.
- **Autonomous recovery.** If too few places match, the agent widens the search radius once and says so; if nothing matches, it returns `no_match` with ways to relax the plan instead of inventing a restaurant.
- **Grounded copy.** The LLM writes the "why you'll both love it" lines from a JSON of verified facts, treated as untrusted data, and is told never to add dishes, hours, prices or waits, and to credit a specific favorite only when Qloo's explainability names it. The picks arrive first with fact templates; the LLM lines stream in afterwards as their own events (on-screen picks first), so the model never delays the result. Without an LLM key, the templates stay and the trace says so.
- **MCP.** `/api/mcp` exposes `find_table_for_two` and `taste_overlap` (Streamable HTTP). Example client config: `{"tastetogether": {"url": "https://tastetogether.vercel.app/api/mcp"}}`.

### Fair ranking (no black box)

For each person, [`rank.ts`](src/lib/taste/rank.ts):

1. z-scores Qloo affinities within the shared pool (removes scale differences between people);
2. regresses out place popularity to isolate the taste-specific part (“lift”);
3. blends overall fit and lift into a 0–1 percentile fit.

Duo score = `0.6·min(fitA, fitB) + 0.2·mean + 0.14·occasion/vibe match + 0.06·rating − 0.15·closed at plan time`. The `min` term means the pick must work for the less-excited person. “Most shaped by” compares each favorite's explainability share for this place with its average share across the pool, and names a favorite only when it clearly stands out. Unit tests cover the ranking, including that raw popularity cannot win on its own.

### Honesty by design

- Names, addresses, hours, price levels, tags and dishes come from Qloo. Unknown hours show as **Hours unverified**; no wait times or per-person prices are shown.
- Open status is checked against the planned meal time (tonight, or tomorrow if it's late), never against “now”.
- `needs_clarification`, `no_match` and `provider_unavailable` are never rendered as a recommendation.
- Sample people are fictional and labeled; their favorites are real Qloo entities, so every demo run calls the live API.
- Keys stay on the server; match, search and MCP endpoints are rate-limited per IP with a daily run cap.

## Rooms and saved profiles

The original TasteTogether flow is still available: saved taste profiles with dining history (`/taste`), solo discovery (`/solo`), and two-browser rooms with invite links, shared constraints and feedback (`/room/new`). It is backed by libSQL/Turso with signed anonymous sessions and object-level ownership checks.

```text
L5 UI (src/app, src/components)  →  L4 HTTP routes (src/app/api)  →  L3 services (src/server/services)
L2 persistence (src/server/db) · Qloo adapter (src/server/qloo) · LLM adapter (src/server/llm)  →  L1 pure domain (src/domain)
```

## Setup

Node.js 20+ and a Qloo hackathon API key:

```bash
npm install
bash scripts/setup-qloo.sh   # stores QLOO_API_KEY and QLOO_API_URL in .env.local (hidden prompt)
npm run dev                  # http://localhost:3000
```

The local database is created at `data/local.db` on first use. Optional: run `bash scripts/setup-anthropic.sh` to enable the vibe-translation agent and LLM-written explanations with your own Anthropic key (it checks the key, saves it to `.env.local` and can add it to Vercel production); everything else works without it. The app never uses platform AI credits implicitly.

| Variable | Purpose |
| --- | --- |
| `QLOO_API_KEY` | Required server-side key for live Qloo requests |
| `QLOO_API_URL` | Defaults to `https://hackathon.api.qloo.com` |
| `ANTHROPIC_API_KEY` | Optional; enables the LLM agent steps |
| `ANTHROPIC_MODEL` | Optional model id (default `claude-haiku-5-5`) |
| `TASTE_DAILY_RUN_CAP` | Optional max match runs per server instance per day (default 2000) |
| `DATABASE_URL` / `TURSO_DATABASE_URL`, `DATABASE_AUTH_TOKEN` | libSQL for rooms and saved profiles; empty = local file |
| `SESSION_SECRET` | Signing secret for rooms; at least 32 characters in production |
| `QLOO_MAX_CALLS_PER_HOUR` | Optional per-process Qloo call limit for the rooms flow |

## Tests

```bash
npm test             # unit tests: ranking, occasion filters, domain, security, Qloo adapter (synthetic fixtures)
npm run typecheck
npm run qloo:smoke   # optional live smoke test against the real API
```

See [docs/TESTING.md](docs/TESTING.md) for manual two-browser and failure checks.

## Deployment

Vercel with a Turso database from the Vercel Marketplace (injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`). Set `QLOO_API_KEY`, `QLOO_API_URL` and `SESSION_SECRET`, then `vercel deploy --prod`. The match and MCP endpoints stream and need no extra configuration beyond `maxDuration = 60`.

## What was built during the hackathon

Everything in this repository was written during the submission period (Sep 30 – Oct 30, 2026): the rooms/profile foundation first, then the cross-domain experience (landing page, `/match`, streaming agent, fair ranking, taste DNA, proof panel, “Before a show”, MCP server).

## Known limitations

- Launch areas are Berkeley and Oakland neighborhoods (plus “near me”); Qloo coverage elsewhere is untested.
- Price levels are categories, not exact costs. Distances are straight-line walk estimates.
- Hours come from Qloo and are interpreted in `America/Los_Angeles`; reservations and wait times are not available.

## License

[MIT](LICENSE), copyright 2026 Victor Chun.
