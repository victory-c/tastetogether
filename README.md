# TasteTogether

TasteTogether is a two-person dining agent with memory for the Berkeley area. It also supports solo discovery: people record preferences and dining history, then use shared constraints and history to find a place to eat together. The demo uses two fictional, clearly labeled sample people and real Qloo requests.

Live demo: https://tastetogether.vercel.app (click **Try the one-minute demo**; no sign-up needed)

## How Qloo is used

Qloo entity search resolves places to confirmed entities. For discovery, the app calls `/v2/insights` separately for each participant, merges the candidates, and filters them against the shared constraints and history. It then uses `filter.results.entities` to score the shared candidate pool against each person's own signals. Affinity values are compared only within one query and converted to rank utility. The final shared order prioritizes `min(uA, uB)`, then the mean utility, followed by distance and entity ID for ties.

## Architecture

```text
+------------------------------------------------------------------+
| L5  UI (src/app/(pages), src/components): calls only L4 HTTP API |
|     User-facing copy comes from src/copy/en.ts                   |
+------------------------------------------------------------------+
| L4  HTTP routes (src/app/api/**/route.ts)                        |
|     Parse with zod, get session, call L3, map errors to English  |
+------------------------------------------------------------------+
| L3  Services / orchestration (src/server/services)               |
|     Recommendations, sessions, memories, feedback               |
+-------------------+----------------------+-----------------------+
| L2a Persistence   | L2b Qloo adapter     | L2c LLM adapter       |
| src/server/db     | src/server/qloo      | src/server/llm        |
| Repositories and  | Timeout, retry,      | Constrained explanation|
| ownership checks  | budget, mapping      | and template fallback  |
+-------------------+----------------------+-----------------------+
| L1  Pure domain functions (src/domain), no I/O                   |
|     Types, hard filters, novelty, ranking, decision, validation  |
+------------------------------------------------------------------+
```

Dependencies point downward. The UI uses HTTP and shared API types; it does not import server code.

## Setup

Use Node.js 20 or later and a Qloo API key. From a clean checkout:

```bash
npm install
bash scripts/setup-qloo.sh
npm run dev
```

The setup script saves the Qloo key and host in `.env.local`. Its current prompts are in Chinese. To configure other variables, copy the relevant entries from `.env.example` into `.env.local`. The local database and migrations are created automatically at `data/local.db` when first accessed. Open `http://localhost:3000`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `QLOO_API_KEY` | Required server-side key for live Qloo requests. |
| `QLOO_API_URL` | Qloo host; defaults to `https://hackathon.api.qloo.com`. |
| `DATABASE_URL` | libSQL URL; leave empty for the automatically created local database. `TURSO_DATABASE_URL` (set by the Vercel Turso integration) is also read. |
| `DATABASE_AUTH_TOKEN` | Token for a remote libSQL database. |
| `SESSION_SECRET` | Signing secret; at least 32 characters in production. |
| `ANTHROPIC_API_KEY` | Optional key for generated explanations. |
| `ANTHROPIC_MODEL` | Optional model for generated explanations. |
| `QLOO_MAX_CALLS_PER_HOUR` | Optional per-process Qloo call limit. |

Keep secrets in local or deployment environment settings, never in the repository.

## Tests

```bash
npm test
npm run typecheck
npm run qloo:smoke
```

The smoke test hits the real Qloo API and reads `.env.local`; it requires a valid key and network access. Mock fixtures are test-only. See [the manual acceptance guide](docs/TESTING.md) for the solo, two-browser, failure, and language checks.

## Deployment

Deployed on Vercel with a Turso libSQL database added through the Vercel Marketplace integration, which injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Also set `QLOO_API_KEY`, `QLOO_API_URL` and a unique `SESSION_SECRET` of at least 32 characters, then run `vercel deploy --prod`. The schema is created automatically on the first request. `.vercelignore` keeps local env files and the local database out of uploads.

## Known limitations

- Price levels are categories, not exact costs or guaranteed bills.
- Distances are straight-line distances, not travel routes.
- Qloo hours are interpreted in `America/Los_Angeles`; missing hours remain unverified.
- Wait-time and reservation data are not available.
- LLM explanations are optional and fall back to fact-based templates.
- Mock fixtures are used only in tests, not as live demo recommendations.

## License

[MIT](LICENSE), copyright 2026 Victor Chun.
