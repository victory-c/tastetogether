# Taste Together Product Requirements Document

Original planning document (translated from Chinese). The shipped product evolved beyond this spec — see README.md.

Version: v0.2 · Date: October 30, 2026 · Product owner: Victor Chun

Status: pre-development requirements draft. The product name is provisional; this document defines the intended behavior and does not represent existing code, data integrations, or deployments.

## 1 Product definition and decisions

Taste Together is a personal dining agent with long-term memory. When used alone, it learns the user's tastes and records restaurants they have eaten at and want to try. When two people plan a meal together, each person's agent hands the necessary preferences to a coordination flow, which combines location, budget, time, and the purpose of this particular meal to find restaurants both people can accept. Users can ask for three options, or let the system pick one place directly.

Core product promise: help two people find a restaurant that suits both of them, fits this occasion's constraints, and as far as possible is somewhere they have not already been — and reduce the burden of making the decision. Recommendations must be traceable to real candidates and known facts.

This round first validates a single two-person dining loop. Long-term directions include automatic history import, reliable queue and reservation information, and timing optimization. The competition version does not promise real-time queue prediction.

**Execution boundary: pursue this competition only if a real Qloo integration, public deployment, and submission can be completed within about one day; do not sacrifice classes, required coursework, or other committed submissions.** Suggested cap: 8 focused hours of actual development, plus a separate buffer for submission; this is not confirmed personal availability.

## 2 User problems and goals

| Problem | Product behavior | What success looks like |
| --- | --- | --- |
| Two people have different tastes and go back and forth for a long time | Evaluate both people's preferences and constraints at the same time | Both see shared options, rather than one person's ranked list |
| Recommendations are always places already visited | Record history; provide a "neither of us has been" toggle | Excluded places are no longer recommended again and again |
| Too many options, hard to decide | Three options, or pick one directly | Users can act right away |
| Last-minute plans where the budget and location don't fit | Make hard constraints explicit and filter before ranking | Explanations are never used to paper over results that fail the conditions |
| Don't want a long wait for a date or business meeting | Later, introduce verifiable reservation and wait data | Recommended times are evidence-based; unknown information is clearly marked |

First target users: people who often eat out with a regular friend, partner, or classmate; people who already have some restaurant experience and want to try new places; people who struggle to choose but are willing to let the system decide.

The first version's region is Berkeley plus a configurable surrounding range; the actual launch area will be determined by Qloo's measured coverage. Only one or two people are supported; "three" refers to the number of results, not three participants.

## 3 Core user journeys

### 3.1 Building personal memory

1. The user creates a personal profile, choosing their usual area, price level, cuisines they definitely won't eat, and preferences.
2. The user adds at least three favorite restaurants or resolvable interest entities. When input is insufficient, the agent asks follow-up questions first rather than filling in tastes on its own.
3. The user manually adds restaurants they have eaten at, or pastes a block of text notes.
4. The agent extracts restaurants, how much they were liked, number of visits, and willingness to revisit, and shows a list pending confirmation.
5. The user confirms entities and records before they are saved; model guesses must not be written directly into memory.
6. The user can request recommendations alone, with the same history exclusion and decision strength as two-person mode.

### 3.2 Two-person meal

1. The host creates a meal room, choosing the area, time window, price level, dining occasion, and decision mode.
2. The host shares an invite link; the other person joins in their own browser and authorizes their profile to be used in this match.
3. Both people confirm this meal's conditions, including "neither of us has been, per our records". A hard constraint raised by either person cannot be silently cancelled by the other.
4. The system fetches Qloo recommendations for each person separately, unifies candidate entities, filters by constraints and history, then produces a shared ranking.
5. The system shows three recommendations or one top pick, explaining why it suits both people, the factual basis, and any unconfirmed information.
6. Users can select one, try another, or explicitly relax a condition. Selecting a restaurant does not automatically create a reservation or payment.
7. After the meal, each user actively confirms the actual visit and gives feedback, updating their own memory; recommendation impressions or clicks must not be treated as visits.

### 3.3 Judge experience

The home page provides a "one-minute experience" entry that loads two fictional profiles clearly labeled as samples; recommendations are produced through real Qloo requests. Sample history is isolated from real user data and can be reset in one click. Test steps for joining a room from two browsers are also provided.

## 4 Scope and priorities

| Capability | P0 competition loop | P1 later product | P2 exploration |
| --- | --- | --- | --- |
| Personal profile | Preferences, restrictions, price level, area | Cross-device accounts and profile management | Richer cross-domain interest import |
| Dining history | Manual add, edit, delete | Natural-language bulk import with confirmation | Authorized connections to external history sources |
| Solo recommendations | Real Qloo candidates with history filtering | Finer-grained personalized learning | Long-term exploration strategy |
| Two-person matching | Invite room, two independent profiles, coordinated ranking | Regular dining buddies, shared wishlist | Multi-person group coordination |
| Decision modes | Three options, just pick, try another | Different exploration strengths | Automatic feedback follow-up |
| Novelty | Exclude entities either person has visited | Recent-repeat penalty, preferences across branches of a chain | More sophisticated explore/revisit balance |
| Time | Input a time window; judge only when hours data exists | Verifiable reservation slots | Historical and real-time wait prediction |
| Occasion | Friends, date, business; soft preference only | Sourced noise and ambience tags | Occasion-specific timing optimization |
| Reservations | Verified external official website or map link | Show reliable bookable slots | Book on the user's behalf after user confirmation |

P0 does not include third-party account import, map route optimization, automatic reservations, payments, native mobile apps, or multi-model debate. Natural-language history import is valuable, but manual records are enough to prove the core experience; when time is short, prioritize manual records.

## 5 Functional requirements and acceptance

### F01 Personal profile and history

- Every profile must have an independent owner; one user cannot edit another user's profile.
- History fields include at least the restaurant entity ID, name, location, status, rating, and revisit intent; date and visit count may be unknown.
- Status distinguishes visited, want_to_try, and dismissed; "haven't been" and "didn't like" must not be conflated.
- Manually entered restaurants that cannot be matched are kept as unresolved, and the user is prompted to add an address or select an entity; never fabricate a Qloo ID.
- Restaurants with the same name are distinguished by entity ID and address; aliases of the same restaurant should be merged; different branches of a chain are treated as independent by default.
- Records persist after a browser refresh; users can delete records and reset the sample profiles.

Acceptance: add, refresh, edit, and delete each succeed; a recommendation or a rejection is never counted as visited; fuzzy matches are never auto-confirmed.

### F02 Solo recommendations and two-person coordination

- Solo queries use the person's positive interests as Qloo signals; restrictions, budget, and history are handled explicitly in the application layer.
- Two-person queries must keep both people's signals independent; it is not acceptable to simply concatenate all interests and claim both people have been fairly accounted for.
- The coordination flow has explicit states: waiting for the second person, pending confirmation, querying, waiting for the user to relax a condition, recommendations complete, and failed (retryable).
- Each recommendation run is bound to profile versions and a constraint version. When either person changes a condition, old results are marked stale and regenerated.

Acceptance: when B's input changes, the system re-queries or re-evaluates and records a new version; the result may stay the same, but it must actually use B's new input.

### F03 Budget, location, and time

- P0 represents budget as a price level, to avoid mistaking dollar-sign tiers for an exact per-person spend.
- If the user enters "$30 per person", preserve the original meaning and clearly show that filtering can currently only use price levels and that the final bill cannot be guaranteed.
- The area defaults to a center and range confirmed by both people; whenever a distance is shown, it must be labeled as straight-line distance or real route distance.
- Times are stored and displayed in the restaurant's local time zone. When opening-hours information is missing, show "Hours unverified"; never say "open at that time".
- When there is a strict exact budget or a strict opening-hours requirement but no verifiable data, enter the conditions-pending-confirmation state; never output "all conditions met".

### F04 Novelty and decision strength

- "Neither of us has been, per our records" is on by default and excludes the union of visited_A and visited_B.
- When there is unresolved history, warn that history exclusion may be incomplete and allow the user to confirm additional entries.
- Three-option mode shows at most three places; when fewer than three qualify, show the actual number honestly rather than padding the list.
- Pick mode highlights only one top pick; the user does not need to browse the other candidates first, and a "try another" entry is kept.
- Try another adds that place to this session's exclusion set; it is not written to a permanent dislike list by default. The reason for this rejection may be recorded.
- When no qualifying candidates are found, explain the conflict and offer options such as expanding the area, adjusting the budget, or allowing revisits; a condition is relaxed only after the user chooses to do so.

Acceptance: places A has visited, places B has visited, and places already rejected in this session never reappear while the relevant exclusions are on; having no results is never a reason to fabricate restaurants.

### F05 Recommendation explanations

Each card includes the name, address, budget information and its source, match reasons for both people, novelty status, opening-hours information status, and an external link to view the place. An expandable "Why this pick" section distinguishes three kinds of evidence: information the users explicitly provided, Qloo's recommendation signals, and restaurant facts from other sources.

The LLM may only explain structured facts and the ranking result; it must not invent restaurants, dishes, opening hours, noise levels, or wait times in minutes. If there is no explainable cross-domain relationship, it may only say "recommended based on your interest signals", and must not fabricate claims such as "people who like a certain movie will definitely like this restaurant".

### F06 Feedback loop

After confirming a visit, the user chooses liked, neutral, or disliked, and whether they would revisit. Each person's feedback is independent; one person's confirmation cannot write a visit record for the other. The next recommendation reads the updated memory.

## 6 Coordination and ranking design

The logical roles are Personal Agent A, Personal Agent B, and Coordinator. The first version can implement them inside a single server-side flow; keeping the roles separate does not require three separate models or long-running agents.

Execution order: parse the request → validate and confirm missing constraints → fetch both profiles' authorized views → resolve valid entities → call Qloo separately for each person → merge candidates → hard filter → rank for both people → generate explanations → validate output → return results. When a tool is unavailable, return an explicit status.

For P0, a transparent, reproducible ranking rule is recommended, rather than letting the LLM arbitrarily decide the final list:

1. First exclude candidates that fail the location, known price level, restrictions, history, or this session's rejections.
2. For candidates that appear for both people, compute the normalized rank utilities uA and uB within each person's valid Qloo list. This value is only a ranking heuristic for this run, not a probability of satisfaction.
3. Sort by min(uA, uB) descending, so that a poor match for either person is avoided first; then break ties by average utility, verified distance, and so on.
4. A candidate that appears only in one person's list does not mean the other person dislikes it. First check whether the same candidate can be additionally evaluated for the other person; while that API capability is unverified, do not invent a score for the other person. If shared evidence is insufficient, say so and ask the users to adjust the conditions.
5. To avoid false "no results" caused by an overly narrow list, one bounded candidate expansion may be performed, keeping all hard constraints.

This rule is a product proposal to be tested in practice, not Qloo's official scoring method. Whether raw affinity values are directly comparable across queries needs to be verified; averaging them without verification is prohibited. Qloo is responsible for providing candidates and interest associations; the application is responsible for memory, constraints, fair ranking, and decision modes.

## 7 Qloo and external data boundaries

The official public documentation supports recommendations based on interest entities and location, and also provides entity lookup and restaurant-related examples. This documentation evidence does not mean that this project's key, quota, local coverage, or all fields are already available.

| Data | Planned source | Current status |
| --- | --- | --- |
| Interest entities and recommendation candidates | Qloo Entity Search and Insights | Capability confirmed in documentation; no real request executed yet |
| Visit records and feedback | User input and the application database | To be implemented; not provided automatically by Qloo |
| Address, price level, opening-hours fields | Measured Qloo response values or licensed place data | Fields and coverage to be verified |
| Exact per-person price, menu | Restaurant's official website or a reliable licensed source | Not guaranteed in P0 |
| Bookable slots | A licensed reservation data service | Not selected, not integrated |
| Historical busyness and waits | A data source we have the right to use | Availability not verified |
| Real-time queue | A licensed API from the restaurant or a queue service | Not verified; not implemented in P0 |

Wait information must later store source, observed_at, the applicable date and time slot, estimated_wait_minutes, confidence, and expires_at. Missing values use null, never 0. Historical busyness must not simply be relabeled as queue time; predictions must show an estimated range, and expired information must not be used as a real-time basis.

P1 timing optimization treats "restaurant × feasible time slot" as the candidate: first satisfy both people's availability, then weigh taste, travel, and evidence-based wait risk. Without reliable data, only show times that need confirmation, and never output a "best low-wait time". Reservation availability does not guarantee zero wait.

## 8 Data model and interface contracts

The following are internal application contracts, not Qloo endpoint definitions.

| Object | Core fields |
| --- | --- |
| Profile | id, owner_id, region, positive_entity_ids, excluded_tags, price_preference, version |
| DiningMemory | id, profile_id, place_id or unresolved_name, address, status, visit_date, visit_count, rating, revisit_intent, source |
| MatchSession | id, participant_ids (at most 2), constraints, decision_mode, novelty_policy, consent_status, version, expires_at |
| RecommendationRun | id, session_id, profile_versions, constraint_version, provider_request_refs, candidate_ids, ranking_evidence, result, created_at |
| VenueEvidence | place_id, field, value, source, observed_at, confidence, expires_at |
| Feedback | run_id, profile_id, place_id, selected or dismissed or visited, rating, reason, created_at |

Suggested internal APIs: POST /api/profiles; POST /api/memories; POST /api/sessions; POST /api/sessions/{id}/join; PATCH /api/sessions/{id}/constraints; POST /api/recommendations; POST /api/feedback. Editing and deleting records must include ownership checks. Recommendation retries use an idempotency key to prevent duplicate runs.

The result structure must include the status, the candidate list, recommendation evidence, unknown fields, conditions requiring user confirmation, and data sources. status must support at least success, needs_clarification, no_match, and provider_unavailable; the front end must never render the last three as a successful recommendation.

## 9 Pages and interaction

1. Home: one-line product pitch, start solo, invite a friend, sample experience.
2. My Taste: preferences and history list, add restaurants, entities pending confirmation, edit and delete.
3. Meal room: participant status, shared conditions, decision strength, generate button.
4. Recommendation results: one main card or three equal-weight cards, reasons, unknown information, try another, confirm selection.
5. Meal feedback: whether the place was actually visited, rating, revisit intent.

**Hard language requirement: all user-facing product content must be in English — not "English first", and not switched automatically based on browser language.** The Chinese in the original PRD was for development communication and must not be copied verbatim into the product.

- This covers all pages, navigation, buttons, forms, placeholders, onboarding, invites, notifications, loading states, empty states, error messages, help, and accessibility labels.
- The agent's follow-up questions, recommendation reasons, preference summaries, history-import confirmations, feedback, and fallback templates must be in English; when the user types in Chinese, system-generated replies are still in English.
- Sample profiles, demo data descriptions, the public README, deployment and testing instructions, and Devpost materials are all in English.
- Users' original input and restaurants' official names are kept in their original language for accuracy; product-generated explanations are in English, and English names for restaurants must not be invented.
- Model prompts explicitly require English output; the front end manages English copy centrally, and raw upstream errors must never be shown directly to users.
- Before release, check the full happy path and the error branches; no user-facing Chinese placeholder copy may remain.

Suggested English labels: Show me 3 options, Pick one for us, Try another, Exclude places either of us has visited, Hours unverified, Wait time unavailable.

The product must be usable on mobile; a native app is not required. While loading, show the real stages; do not fake agent conversations to manufacture the appearance of work.

## 10 Engineering approach and security requirements

Suggested: one full-stack web project, one persistent database, a server-side Qloo adapter, and an LLM adapter. Choose the stack the developer knows best and can deploy; the specific framework and hosting platform are implementation choices, and this PRD does not claim that any existing project already has these capabilities.

Anonymous users can own profiles through a secure, server-issued session, so a full registration system is not needed on day one. An invite token only authorizes joining the specified room; it does not authorize reading either person's full history. Rooms expire by default and can be revoked; public samples contain only fictional data.

- API keys are used only on the server; they never go into the browser bundle, logs, screenshots, or the public repository.
- Enforce object-level access control on profiles, records, and rooms; do not rely solely on hidden URLs.
- Shared output uses only the necessary preference summary; never show the other person's full spending history or raw imported text.
- External restaurant descriptions and user records are treated as data and must never become tool-execution instructions.
- Set timeouts, bounded retries, rate limits, and an overall budget limit to keep the public demo from exhausting its quota.
- Verify the applicable terms before caching or storing Qloo response data; open-sourcing the code does not mean third-party data may be redistributed.
- When Qloo fails, show a retryable error; clearly labeled past results may be shown, but never pretend a live query just completed.
- When the LLM explanation fails, fall back to factual templates; never remove Qloo and still claim to be Qloo-powered.

## 11 Acceptance criteria and measurement

P0 must pass:

1. A new user can complete the sample experience on a public web page with no private approval; recommendations actually call Qloo.
2. After a solo user adds history, it is still readable after a refresh, and querying again excludes that place.
3. Two independent browsers can join the same room, each using and protecting its own profile.
4. Exclusion of the union of both histories, restrictions, location, and verifiable budget limits all take effect.
5. Three-option mode and pick mode work; try another never repeats a restaurant rejected in this session.
6. Fewer than three results, zero candidates, unresolved entities, missing opening-hours information, and API timeouts all have honest status handling.
7. After constraints change, old results become stale; one person cannot modify the other person's profile without authorization.
8. Names, addresses, and the facts in the reasons are traceable; no queue times or spending amounts are fabricated.
9. History is written only after the user confirms a visit; each person's feedback is independent.
10. The demo and the public repo can be accessed from an incognito window, and the README can guide running the project from a clean environment.
11. Check the solo, two-person, sample, empty-state, and failure flows under both English and Chinese browser settings: all system-generated user-visible content is in English, and Chinese user input does not change the output language.

Testing uses a set of controlled mock responses to verify constraints and error branches, then uses real Qloo for end-to-end smoke tests. Mock responses must be used only for tests and must never serve as real data in the competition demo. Add two-user permission tests and a post-release key-leak check.

Provisional performance target: normal requests complete within 30 seconds; beyond that limit, show a retryable state. Actual latency and quota limits will be revised after the first real measurements.

Product metrics: time from joining a room to selecting a restaurant, two-person confirmation rate, top-pick acceptance rate, number of "try another" clicks, share of rejections caused by repeated history, and share of runs that successfully obtain real Qloo results. There is no user baseline yet, so do not claim these metrics have improved.

Suggested demo contrast: fix the same location and budget, then use A's, B's, and A+B's profiles in turn; show the shared results and how history exclusion changes them. This comparison demonstrates that the inputs take effect; it is not sufficient to claim the product has been scientifically proven better than all LLM recommendations.

## 12 One-day implementation plan and stop conditions

| Phase | Time budget | Deliverables and gates |
| --- | --- | --- |
| G0 Feasibility check | 0–60 minutes | Obtain the key; complete a real entity lookup and a local restaurant recommendation; confirm fields, quota, and the deployment path |
| G1 Solo loop | 1–3 hours | Profile, history persistence, real candidates, hard filtering, personal results |
| G2 Two-person coordination | 3–5 hours | Invite and join, both people's constraints, shared ranking, three options and pick, feedback |
| G3 Public deployment | 5–6.5 hours | External deployment, environment variables, sample profiles, incognito-window testing |
| G4 Delivery and submission | 6.5–8 hours | Permission and core acceptance checks, README, license, English description, Devpost submission |

At G0, if the key has not arrived, local candidates are insufficient, or the API cannot support the core queries, stop this competition sprint; the product idea can be kept, but do not rush a submission with a fake integration. If G1 clearly overruns, first cut natural-language import and visual polish; never cut real Qloo, two-person conditions, history exclusion, or public availability and then claim the original product is complete.

Project reuse status: no existing repository was inspected in this round, so do not assume there is an existing Qloo integration, login, database, or directly publishable project. At the start of development, spend at most 20 minutes verifying the startup method, dependencies, licensing, and deployment status of any repository proposed for reuse; reuse only the parts that run and that we have the right to make public, otherwise use a familiar small scaffold. Pre-existing code and features added during the competition must be described separately.

## 13 Build, deployment, repository, and submission checklist

### Build

1. Determine the API host, authentication method, and entity parameters for the key from publicly available official documentation; do not copy untested SDK default addresses.
2. Run one real minimal request, record the field structure (redacted), and choose candidate and filtering implementations that actually work.
3. Create an example environment-variable file; first complete the vertical slice from input to Qloo to page, then add the database and two-person rooms.
4. Write independent functions for hard filtering, two-person ranking, and source validation; the LLM is responsible for intent parsing and constrained explanations.
5. Run acceptance against this PRD, and keep repeatable two-user test steps.

### Deployment

1. Connect a hosting environment with server-side runtime capability; configure the database and server-side secrets.
2. Run database migrations, build checks, and the deployment; enable TLS and basic rate limiting.
3. Test the sample with a logged-out browser and the invite flow with two browsers; check that production really calls Qloo.
4. Set up error monitoring and spending caps; confirm that quota exhaustion will not take the app down entirely during judging.

### Public repository

1. Publish the code after checking there are no secrets, private records, or non-public assets.
2. Add a recognizable open-source LICENSE; MIT is a candidate, but it must be compatible with the licenses of reused dependencies and assets.
3. The README includes a product overview, architecture, where Qloo is really used, environment variables, installing and running, database initialization, deployment, testing, and known limitations.
4. Include .env.example, the dependency lockfile, how sample data is generated, and all necessary source files; do not commit the actual .env.
5. Set the demo link in the repository's About section and confirm the license is detected. Record the submitted version.

### Devpost

1. Confirm registration and the submission entry; fill in the English product summary, features, Qloo's substantive role, technical implementation, and limitations.
2. Add a publicly accessible working demo URL and the public repository URL; verify that neither has private access restrictions.
3. Explain the sample experience and how to test with two people; if an old project is reused, clearly state what is new this time.
4. According to the event page provided by the user, a video is not required; do not let filming a video eat into core validation time.
5. Submit before the deadline of 20:45 PDT on October 30, 2026; the suggested internal target is 19:45 PDT. The final event page is authoritative.
6. Confirm the entry is submitted, not just saved as a draft, and save the submission link. Keep the service running at least through the official judging period; if shortlisted, separately confirm attendance and preparation.

## 14 Decisions still to be verified

- Whether the Qloo key has been obtained, the real request quota, and the usable host.
- Berkeley restaurant coverage and the availability of price and opening-hours fields; whether supplementary evaluation is supported when there are too few shared candidates.
- Which existing project can legally be made public and deployed quickly.
- Whether we have access to reliable wait or reservation data; do not promise to launch this before it is verified.
- Whether the development time actually available is sufficient and does not conflict with classes or other submissions.

## 15 Sources and verification log

This draft uses Victor's product description in this conversation as the basis for its requirements. The Notion tracker was not read or modified; no existing project repository was inspected, no API key was obtained, and no Qloo request was executed.

- Official competition rules: https://qloo.devpost.com/rules — read on October 29, 2026. The deadline is October 30, 23:45 EDT, i.e., 20:45 PDT; the rules include requirements for a real Qloo integration, a public open-source repository, a demo, a description, and English materials. The clause about pre-existing projects has a text-formatting anomaly; when reusing a project, clearly state the new contributions and, if necessary, confirm with the organizers.
- Original event requirements provided by the user: public external deployment, a visible license, and no required video; this draft adopts these more explicit delivery conditions.
- Official Qloo API overview: https://github.com/qloo/docs-public/blob/main/reference/api-overview.md — supports parameterized recommendations by interests, location, and more, as well as entity lookup.
- Official restaurant recipes: https://github.com/qloo/docs-public/blob/main/recipes/recipes.md — includes examples of querying restaurants by interest entities and location.
- Official Insights deep dive: https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md — describes parameters such as price level; the specific key and response fields still need to be tested for real.

All technical implementation choices, priorities, time budgets, and ranking methods in this PRD are proposed designs, not completed status or guarantees from the organizers.
