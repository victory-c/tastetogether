import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

import { encodePerson } from '@/lib/client/invite';
import { isQlooConfigured } from '@/lib/qloo/client';
import { allow, underDailyBudget } from '@/lib/server/rate-limit';
import { runMatch } from '@/lib/taste/engine';
import { AREAS, DEFAULT_AREA, OCCASIONS } from '@/lib/taste/occasions';
import { resolveAll } from '@/lib/taste/resolve';
import type { MatchRequest, Person, Pick, TasteDna } from '@/lib/taste/types';

export const maxDuration = 60;

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');

const personInput = z.object({
  name: z.string().min(1).max(24).describe('First name'),
  favorites: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(8)
    .describe("Artists, films, TV shows or books this person loves, e.g. ['Phoebe Bridgers', 'Dune']"),
});

function summarize(p: Pick, aName: string, bName: string) {
  return {
    name: p.name,
    cuisine: p.cuisine,
    price: p.priceLevel ? '$'.repeat(p.priceLevel) : 'unknown',
    address: p.address,
    open: p.open,
    why: p.why,
    [`${aName}_rank`]: `#${p.fitA.rank} of ${p.fitA.of}`,
    [`${bName}_rank`]: `#${p.fitB.rank} of ${p.fitB.of}`,
    shaped_by: { [aName]: p.fitA.drivers[0]?.name, [bName]: p.fitB.drivers[0]?.name },
    occasion_tags: p.occasionTags,
    known_for: p.dishes,
    directions: p.mapsUrl,
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'find_table_for_two',
      {
        title: 'Find a restaurant two people will both love',
        description:
          "Uses Qloo's cultural taste graph to pick restaurants in the Berkeley/Oakland area that fit BOTH people, based on the music, " +
          'films, TV and books each person loves. Every candidate is scored for each person separately and ranked for fairness. ' +
          'Returns real places with facts from Qloo; never invents hours or prices.',
        inputSchema: z.object({
          a: personInput,
          b: personInput,
          occasion: z.enum(['date', 'friends', 'business', 'coffee']).default('date'),
          area: z.enum(AREAS.map((x) => x.id) as [string, ...string[]]).default(DEFAULT_AREA.id),
          price_max: z.number().int().min(1).max(4).optional().describe('1 = $, 4 = $$$$'),
          vibe: z.string().max(200).optional().describe("Free text such as 'cozy, not too loud'"),
        }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ a, b, occasion, area, price_max, vibe }) => {
        if (!isQlooConfigured() || !underDailyBudget()) {
          return { content: [{ type: 'text', text: 'TasteTogether is unavailable right now.' }], isError: true };
        }
        const [ia, ib] = await Promise.all([resolveAll(a.favorites), resolveAll(b.favorites)]);
        const pa: Person = { name: a.name, interests: ia };
        const pb: Person = { name: b.name, interests: ib };
        const req: MatchRequest = {
          a: pa,
          b: pb,
          occasion,
          priceMax: (price_max ?? null) as MatchRequest['priceMax'],
          area: AREAS.find((x) => x.id === area) ?? DEFAULT_AREA,
          mode: 'three',
          vibe,
        };
        let picks: Pick[] = [];
        let note: string | undefined;
        let dna: TasteDna | undefined;
        let failure: string | undefined;
        const trace: string[] = [];
        // Only three picks are returned, so the spares get no LLM copy.
        for await (const e of runMatch(req, { narrateSpares: false })) {
          if (e.type === 'step' && e.status === 'done') trace.push(`${e.label}${e.detail ? ` — ${e.detail}` : ''}`);
          if (e.type === 'dna') dna = e.dna;
          if (e.type === 'result') {
            picks = e.picks;
            note = e.relaxed;
          }
          if (e.type === 'narration') {
            const whys = new Map(e.whys.map((w) => [w.id, w.why]));
            picks = picks.map((p) => ({ ...p, why: whys.get(p.id) ?? p.why }));
          }
          if (e.type === 'error') failure = e.message;
        }
        if (failure || picks.length === 0) {
          return { content: [{ type: 'text', text: failure ?? 'No match found.' }], isError: Boolean(failure) };
        }
        const link = SITE
          ? `${SITE}/match?${new URLSearchParams({ a: encodePerson(pa), b: encodePerson(pb), o: occasion, area, go: '1' })}`
          : undefined;
        const result = {
          resolved_favorites: { [a.name]: ia.map((i) => i.name), [b.name]: ib.map((i) => i.name) },
          shared_taste: dna?.shared.map((t) => t.name) ?? [],
          occasion: OCCASIONS[occasion].label,
          picks: picks.slice(0, 3).map((p) => summarize(p, a.name, b.name)),
          note,
          agent_trace: trace,
          open_in_app: link,
        };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.registerTool(
      'taste_overlap',
      {
        title: "Compare two people's cultural taste",
        description: "Shows what two people's favorite artists, films, shows and books have in common according to Qloo's taste graph.",
        inputSchema: z.object({ a: personInput, b: personInput }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ a, b }) => {
        const [ia, ib] = await Promise.all([resolveAll(a.favorites), resolveAll(b.favorites)]);
        const req: MatchRequest = {
          a: { name: a.name, interests: ia },
          b: { name: b.name, interests: ib },
          occasion: 'friends',
          priceMax: null,
          area: DEFAULT_AREA,
          mode: 'three',
        };
        for await (const e of runMatch(req)) {
          if (e.type === 'dna') {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { shared: e.dna.shared.map((t) => t.name), [a.name]: e.dna.a.map((t) => t.name), [b.name]: e.dna.b.map((t) => t.name) },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          if (e.type === 'error') break;
        }
        return { content: [{ type: 'text', text: 'Could not compare these tastes right now.' }], isError: true };
      },
    );
  },
  { serverInfo: { name: 'tastetogether', version: '1.0.0' } },
);

async function guarded(request: Request) {
  if (!allow(request, 'mcp', 30, 10 * 60_000)) {
    return Response.json({ error: 'Rate limited. Try again in a few minutes.' }, { status: 429 });
  }
  return handler(request);
}

export { guarded as GET, guarded as POST };
