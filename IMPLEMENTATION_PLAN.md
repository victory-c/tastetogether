# TasteTogether Multi-Agent Implementation Plan

Original planning document (translated from Chinese). The shipped product evolved beyond this spec — see README.md.

Date: 2026-10-30 · Based on: [TasteTogether_PRD.md](TasteTogether_PRD.md) v0.2 · Deadline: 20:45 PDT (internal target 19:45 PDT)

This document defines the layering, directory layout, interface contracts, task breakdown, and dispatch rules. **The lead (Claude) owns every part that determines correctness and security; GPT‑6.1 Terra (high, via the `codex exec` CLI) only does parts that are clearly bounded, have frozen contracts, and are cheap to get wrong.** Every dispatched task has explicit file ownership and is merged only after the lead has reviewed it.

---

## 0 G0 feasibility results (2026-10-30 01:56 PDT, real key)

| Item | Result | Implication for implementation |
| --- | --- | --- |
| Host / auth | `https://hackathon.api.qloo.com`, header `X-Api-Key` | The adapter reads `QLOO_API_KEY` on the server only |
| Entity lookup | `GET /search?query=…&types=urn:entity:place&take=n` returns `entity_id`, `properties.address`, `hours`, `geocode`, `external.resy/google_place` | Manual history can be resolved to real entity IDs; misses stay unresolved |
| Recommendations | `GET /v2/insights`, `filter.type=urn:entity:place`, `signal.interests.entities=…`, `filter.tags=urn:tag:genre:place:restaurant` | One call per person, each with that person's independent signal |
| Location | **`filter.location.query=Berkeley, CA` resolves to South Carolina — do not use it**; `filter.location=POINT(-122.2727 37.8716)` + `filter.location.radius=4000` (meters) is correct | Areas always use a WKT point + radius; the returned `query.distance` is straight-line distance (meters), labeled "straight-line" in the UI |
| Price | `properties.price_level` 1–4, may be null; `filter.price_level.max` is supported | Hard filter on price level; null → "Price unverified", and the run enters pending confirmation when the budget is strict |
| Opening hours | `properties.hours` lists `opens/closes` per weekday (`T17:00:00`, no time zone), plus `is_closed` | Interpreted as America/Los_Angeles; when missing, show "Hours unverified" |
| Scores | `query.affinity` 0–1 | **Never compare raw values across queries**; only convert them to rank utility within a single query |
| Supplementary evaluation | `filter.results.entities=<id,id,…>` restricts the result set, scoring the specified candidates by one person's signal (6/6 returned) | The "supplementary evaluation" in PRD §6.4 is feasible; see §3 |
| Natural overlap between the two people | A (Chez Panisse) 20 results vs. B (Cheese Board) 40 results; the intersection is only 1 | Taking only the intersection would produce false "no results" → supplementary evaluation is required |
| Latency | A single insights call ≈ 0.9 s | The 30 s budget is ample; still set an 8 s timeout + 1 retry |

Conclusion: G0 passed; continue the competition sprint.

---

## 1 Tech stack (implementation choices)

- **Next.js (App Router) + TypeScript strict**, full-stack in one project, deployed on Vercel.
- **Database: libSQL (`@libsql/client`)**: `file:./data/local.db` locally, Turso `libsql://…` in production; the same SQL and code for both. Hand-written SQL migrations, avoiding an ORM generation step.
- **Validation: zod** (all API inputs and Qloo response mapping).
- **Testing: vitest** (pure domain functions + adapter mocks + route permissions).
- **Styling: Tailwind CSS**.
- **LLM: optional**. When `ANTHROPIC_API_KEY` is set, it is used only to generate English explanations from already-ranked structured facts; if it is unset or fails → fall back to factual templates (PRD §10). Ranking is never decided by the LLM.
- **Sessions: anonymous, server-issued, HMAC-signed cookie** (`SESSION_SECRET`); one browser = one user.

---

## 2 Layered architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ L5  UI (src/app/(pages), src/components): calls only the L4 HTTP API │  ← GPT (per contract)
│     All copy comes from src/copy/en.ts                               │
├──────────────────────────────────────────────────────────────────────┤
│ L4  HTTP routes (src/app/api/**/route.ts)                            │  ← Lead writes the template and sensitive routes
│     parse zod → get session → call L3 → map to English errors        │     GPT writes same-pattern CRUD routes
├──────────────────────────────────────────────────────────────────────┤
│ L3  Services/orchestration (src/server/services)                     │  ← Lead
│     recommend (coordination flow + state machine), sessions,         │
│     memories, feedback                                               │
├──────────────────────┬───────────────────────┬───────────────────────┤
│ L2a Persistence      │ L2b Qloo adapter      │ L2c LLM adapter       │
│ src/server/db        │ src/server/qloo       │ src/server/llm        │  ← Lead (GPT adds fixtures)
│ repos + ownership    │ timeout/retry/budget/ │ constrained explain + │
│ checks               │ mapping               │ template fallback     │
├──────────────────────┴───────────────────────┴───────────────────────┤
│ L1  Pure domain functions (src/domain), no I/O                       │  ← Lead
│     types, hardFilter, novelty, ranking, decision, validate          │
└──────────────────────────────────────────────────────────────────────┘
```

Dependencies may only point downward: L1 imports no other layer; L2 imports only L1; L5 interacts only through `fetch('/api/…')` and the shared types in `src/lib/api-types.ts`, and **must not import `src/server/**`** (to keep secrets out of the browser bundle; enforced with `import 'server-only'`).

### Directory structure

```
src/
  domain/            L1  types.ts filters.ts ranking.ts decision.ts hours.ts validate.ts  (+ *.test.ts)
  server/
    auth/session.ts  L2  signed cookie, getCurrentUser()
    db/              L2  client.ts migrate.ts migrations/001_init.sql repos/*.ts
    qloo/            L2  client.ts map.ts types.ts fixtures/*.json
    llm/             L2  explain.ts templates.ts
    services/        L3  recommend.ts sessions.ts memories.ts feedback.ts demo.ts
    http.ts          L4  shared route utilities: json(), errors, withUser()
  app/
    api/**/route.ts  L4
    page.tsx …       L5
  components/        L5
  copy/en.ts         L5  all user-visible English copy (managed centrally)
  lib/api-types.ts   L4/L5 shared request/response types (no server dependencies)
scripts/ setup-qloo.sh, seed-demo.ts, qloo-smoke.ts
```

---

## 3 Coordination and ranking algorithm (P0, implemented by the lead, reproducible)

Input: participants P ∈ {A} or {A,B}; constraints C (center point, radius, price cap, restricted tags, time window, occasion, decision mode, novelty toggle); and this session's rejection set R.

1. **Constraint validation**: missing center point/radius → `needs_clarification`. If the user wrote an exact per-person amount (e.g., "$30 per person") → keep the original text as `budget_note`, filter only by price level, and add it to `conditions_to_confirm`.
2. **Authorized view**: each participant exports only `{positive_entity_ids, excluded_tags, price_preference, visited_place_ids, has_unresolved}`, never the full history.
3. **Discover**: for each p, call insights once (p's own positive entities, location, restaurant tag, price cap, take=30).
4. **Merge**: the candidate union U, deduplicated by entity_id.
5. **Hard filter** (`domain/filters.ts`): distance > radius, known price level > cap, matches either person's restricted tags, `is_closed`, ∈ visited_A ∪ visited_B when novelty is on, ∈ R, ∈ dismissed. Record the reason for every excluded candidate (used to explain no_match).
6. **Supplementary evaluation (score)**: in two-person mode, call insights once per p with `filter.results.entities = U'` (the filtered candidates, in chunks of 25) to get p's affinity for each candidate in U' — **all of a given p's scores come from the same query, so they are comparable within p**.
7. **Rank utility**: for each p, sort U' by that p's affinity in descending order, `u_p = 1 - rank/(n-1)` (u=1 when n=1). If a candidate has no score for someone → do not invent one; remove it from the shared ranking and record it in `evidence.missing_scores`.
8. **Ranking**: primary key `min(uA,uB)` descending; secondary key `(uA+uB)/2`; then straight-line distance ascending; finally entity_id for determinism. In solo mode, `u = uA`.
9. **Bounded expansion**: when there are fewer qualifying candidates than needed (three=3, pick=1), the discover stage uses take=60 and radius ×1.5 **only if the user has allowed expanding the area**; otherwise do a single take=60 retry without changing the constraints.
10. **Decision mode**: `three` → at most 3 places, honestly returning fewer if short; `pick` → 1 top pick + keep `try_another`.
11. **Status**: `success | needs_clarification | no_match | provider_unavailable`; `no_match` comes with `relaxation_options` (`expand_radius | raise_price | allow_revisits`), which take effect only after the user explicitly chooses one.
12. **Explanation**: structured evidence → (optional LLM) English reasons → checked by `validate.ts`: every restaurant name that appears in the reasons must be ∈ the result set, and no unprovided facts such as minute counts or dollar amounts may appear; otherwise fall back to templates.

`RecommendationRun` records `profile_versions`, `constraint_version`, a redacted summary of provider requests, candidates, evidence, and results. When the session constraints or either person's profile version change → the old run is marked `stale=true`.

---

## 4 Data model (SQL migration 001, lead)

`users(id, created_at)` · `profiles(id, owner_id UNIQUE, display_name, center_lat, center_lon, radius_m, price_max, excluded_tags JSON, positive_entities JSON, is_demo, version, updated_at)` · `memories(id, profile_id, place_id NULL, unresolved_name NULL, name, address, status CHECK in visited/want_to_try/dismissed, visit_date NULL, visit_count NULL, rating NULL CHECK in liked/neutral/disliked, revisit_intent NULL, source, created_at, updated_at)` · `match_sessions(id, owner_id, invite_token_hash, participant_a, participant_b NULL, consent_b, constraints JSON, decision_mode, novelty_both_unvisited, state, version, expires_at, revoked)` · `recommendation_runs(id, session_id NULL, owner_id, idempotency_key UNIQUE, profile_versions JSON, constraint_version, provider_refs JSON, candidate_ids JSON, evidence JSON, result JSON, status, stale, created_at)` · `feedback(id, run_id, profile_id, place_id, kind CHECK in selected/dismissed/visited, rating, revisit_intent, reason, created_at)`.

Rules: a visitor can only read and write the profile where `profiles.owner_id = me` and that profile's memories; a room is readable only by its two participants, A and B; `dismissed` (rejected in this session) is written to the run's exclusion set, not to memories; only `POST /api/feedback kind=visited` creates a `visited` memory, and it writes only to the caller's own profile.

---

## 5 Task breakdown and ownership

Legend: 🟣 done by the lead (Claude) personally · 🟢 dispatched to GPT‑6.1 Terra high · 🔍 reviewed by the lead

### Wave 0 — Skeleton (🟣, serial, prerequisite for everything else)
- W0.1 Next.js + TS + Tailwind + vitest + zod + libsql scaffold, `tsconfig` path aliases, `npm scripts`.
- W0.2 `src/domain/types.ts`, `src/lib/api-types.ts`: all shared types (the contract freeze point).
- W0.3 `src/copy/en.ts` copy-key skeleton.

### Wave 1 — Core (🟣)
- W1.1 `domain/filters.ts` `ranking.ts` `decision.ts` `hours.ts` `validate.ts` + key tests.
- W1.2 `server/qloo/*`: client (8 s timeout, 1 retry, in-process call budget), zod mapping, search/discover/score.
- W1.3 `server/db/*`: migrations, client, repos with ownership checks.
- W1.4 `server/auth/session.ts`, `server/http.ts`.
- W1.5 `server/services/recommend.ts` (the full §3 flow), `sessions.ts` (stores only the invite token's hash; expiry; revocation; version bumps that mark old runs stale), `feedback.ts`.
- W1.6 Sensitive routes: `/api/sessions/**`, `/api/recommendations`, `/api/feedback`, `/api/demo`, plus one example CRUD route, `GET/PUT /api/profile` (the caller's own profile; GPT writes the remaining routes following this pattern).
- W1.7 Browser-side `src/lib/api-client.ts` and `src/components/ui` base components (shared by both UI tasks to avoid duplicate implementations).

### Wave 2 — Dispatch (🟢, parallelizable, non-overlapping file ownership)
| ID | Task | Files it may modify | Definition of done |
| --- | --- | --- | --- |
| T1 | memories / places search CRUD routes (following the `/api/profile` pattern) | `src/app/api/memories/**`, `src/app/api/places/**` | Calls existing services/repos; no new SQL; `npm run typecheck` passes |
| T2 | Qloo test fixtures + mock tests for the adapter/ranking (fewer than three results, zero candidates, timeout, null price, missing hours, unresolved) | `src/server/qloo/fixtures/**`, `tests/**` | `npm test` all green; fixtures are used only for tests |
| T4 | UI: home page (including the sample-experience entry), AppHeader, My Taste (preferences + history list + search to add + edit/delete + unresolved hints) | `src/app/page.tsx`, `src/app/taste/**`, `src/components/taste/**`, `src/components/AppHeader.tsx`, `src/copy/home.ts`, `src/copy/taste.ts` | Uses only `api-types.ts` and `copy/en.ts`; no Chinese; usable on mobile |
| T5 | UI: solo search, meal room, invite/join page, result cards, try another, feedback | `src/app/solo/**`, `src/app/room/**`, `src/app/join/**`, `src/components/room/**`, `src/copy/room.ts` | Renders all four statuses by `status`; three options/pick; never shows the other person's history |
| T6 | Sample profile data (two fictional people labeled "Sample", using only real Qloo entity IDs provided by the lead; the former T3 is merged in) + README (English), LICENSE (MIT), `.env.example`, manual test steps | `src/server/services/demo-data.ts` (only `DEMO_PEOPLE`), `README.md`, `LICENSE`, `.env.example`, `docs/TESTING.md` | Fictional people only; runnable from a clean environment |

Dispatch rules (written into every prompt):
1. Modify only the files in your ownership list; if a contract change is needed, stop and explain it in your final message instead of modifying `src/domain`, `src/server`, or `src/lib/api-types.ts`.
2. Do not install dependencies, run git write operations, or access the network (the lead tests against real Qloo).
3. All user-visible text is in English and goes into the task's own copy file (`src/copy/home.ts`, `taste.ts`, `room.ts`, re-exported from `src/copy/en.ts`); do not change the core copy.
4. Before finishing, run `npm run typecheck` and `npm test`, and report the results and the list of changed files in your final message.
5. Command: `cat logs/prompts/_common.md logs/prompts/<T>.md | codex exec -m gpt-6.1-terra -c model_reasoning_effort=high -s workspace-write --ephemeral -C <repo> -o logs/<T>.final.md -`. Prompts and logs live in the gitignored `logs/`; the five tasks' files do not overlap, so they run in parallel in the same working tree.

### Wave 3 — Integration and verification (🟣 + 🔍)
- Review each Wave 2 diff one by one (contracts, ownership, permissions, English copy, no fabricated facts).
- Full `typecheck`, `test`, and `build`; real Qloo smoke test (`scripts/qloo-smoke.ts`): compare the A, B, and A+B profiles.
- Two-browser end-to-end: create room → join → change B's constraints so the old run goes stale → generate → try another → confirm visit.
- Check for leftover Chinese under a Chinese browser locale (`grep -P '[\x{4e00}-\x{9fff}]' src/` should return zero hits outside comments).
- Adversarial review: privilege escalation, secret leaks, statuses misrendered as success.

### Wave 4 — Deployment and submission (requires Victor's authorization)
Turso database + Vercel environment variables (`QLOO_API_KEY`, `QLOO_API_URL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`, optional `ANTHROPIC_API_KEY`) → deploy → incognito-window acceptance → public repository → Devpost. Deployment-platform account actions, making the repository public, and the Devpost submission all require Victor's confirmation first.

---

## 6 Risks and stop conditions

| Risk | Mitigation |
| --- | --- |
| The two people's candidates barely intersect | §3.6 supplementary evaluation; if still insufficient, `no_match` + relaxation options, no padding |
| `filter.location.query` misparses the location | Use only POINT + radius |
| The public demo exhausts the quota | Per-process/per-user call budget, ≤ 6 Qloo calls per run, idempotency keys |
| GPT changes go out of bounds | File ownership + lead diff review; out-of-bounds changes are reverted immediately |
| No LLM key | Template explanations are the default path; the LLM is an enhancement |
| Opening hours have no time zone | Always interpret them as America/Los_Angeles and label them as such |

The stop conditions in PRD §12 are unchanged: real Qloo, two-person conditions, history exclusion, and public availability cannot be cut in order to claim completion.

---

## 7 Execution log (2026-10-30)

| Phase | Result |
| --- | --- |
| Wave 0–1 (lead) | Contracts, pure domain functions, Qloo adapter, repositories, coordinator, and sensitive routes done; real Qloo smoke test: the A, B, and A+B result sets all differ, and history-union and restriction filtering take effect |
| Wave 2 (GPT‑6.1 Terra high ×5) | T1/T2/T4/T5/T6 all completed without going out of bounds; T2 caught a real defect in the lead's code (the coordinator did not itself validate LLM reasons), which has been fixed |
| Wave 3 integration | Real data exposed two more field differences: insights' `external.*` fields are arrays, and the tag key in `/search` is `tag_id` (which caused every search result to be dropped); both are now handled, with regression tests added |
| Adversarial review | 4 perspectives, each with 1 rebutter: 22 findings confirmed, 5 rejected. The lead fixed the 13 server/domain findings; the 9 UI findings were dispatched to T7 (GPT) for fixing |
| Verification | `typecheck`, 22 unit tests, and `next build` pass; 28 three-user HTTP end-to-end checks pass (privilege escalation, invite token, confirmation gate, history union, strictest price cap, idempotency, feedback isolation, stale marking); the sample experience, solo search, try another, pick, and visit feedback were all tested hands-on in the browser |

**Wave 4 not started**: deployment (Turso + Vercel environment variables), the public repository, and the Devpost submission require Victor's authorization and account actions.
