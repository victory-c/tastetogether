import { z } from "zod";

import { isQlooConfigured } from "@/lib/qloo/client";
import { allow, underDailyBudget } from "@/lib/server/rate-limit";
import { runMatch } from "@/lib/taste/engine";
import { AREAS, DEFAULT_AREA } from "@/lib/taste/occasions";
import type { MatchEvent, MatchRequest } from "@/lib/taste/types";

export const maxDuration = 60;

const interest = z.object({
  id: z.string().regex(/^[0-9A-Fa-f-]{36}$/),
  name: z.string().min(1).max(120),
  kind: z.enum(["artist", "movie", "tv_show", "book", "podcast", "video_game"]),
  image: z.string().url().optional(),
  year: z.number().int().optional(),
});

const person = z.object({
  name: z.string().trim().min(1).max(24),
  interests: z.array(interest).min(1).max(8),
  visited: z.array(z.string().regex(/^[0-9A-Fa-f-]{36}$/)).max(50).optional(),
});

const schema = z.object({
  a: person,
  b: person,
  occasion: z.enum(["date", "friends", "business", "coffee"]),
  priceMax: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  areaId: z.string().optional(),
  near: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
  mode: z.enum(["three", "one"]),
  vibe: z.string().max(300).optional(),
  exclude: z.array(z.string().regex(/^[0-9A-Fa-f-]{36}$/)).max(60).optional(),
});

function line(event: MatchEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  if (!isQlooConfigured()) {
    return Response.json({ error: "Recommendations are unavailable: Qloo is not configured." }, { status: 503 });
  }
  if (!allow(request, "match", 20, 10 * 60_000) || !underDailyBudget()) {
    return Response.json({ error: "Our taste buds need a breather. Please try again in a few minutes." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "We couldn't read that request. Add at least one favorite for each person." }, { status: 400 });
  }
  const { areaId, near, ...rest } = parsed.data;
  const area = near
    ? { id: "near-me", label: "your meeting point", lat: near.lat, lon: near.lon, radius: 1800 }
    : (AREAS.find((a) => a.id === areaId) ?? DEFAULT_AREA);
  const req: MatchRequest = { ...rest, area };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runMatch(req)) controller.enqueue(encoder.encode(line(event)));
      } catch {
        controller.enqueue(
          encoder.encode(line({ type: "error", status: "provider_unavailable", message: "Something went wrong. Please try again." })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
