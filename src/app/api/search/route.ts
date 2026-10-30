import type { NextRequest } from "next/server";

import { entitiesOf, isQlooConfigured, qlooGet } from "@/lib/qloo/client";
import type { QlooInsightsResponse } from "@/lib/qloo/types";
import type { Interest, InterestKind } from "@/lib/taste/types";
import { allow } from "@/lib/server/rate-limit";

const KINDS: InterestKind[] = ["artist", "movie", "tv_show", "book", "podcast", "video_game"];

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });
  if (!isQlooConfigured()) return Response.json({ error: "Search is unavailable right now." }, { status: 503 });
  if (!allow(request, "search", 120, 60_000)) {
    return Response.json({ error: "You're typing faster than we can taste. Try again in a moment." }, { status: 429 });
  }

  try {
    const body = await qlooGet<QlooInsightsResponse>("/search", {
      query: q.slice(0, 60),
      types: ["artist", "movie", "tv_show", "book"].map((k) => `urn:entity:${k}`).join(","),
      take: 12,
    });
    const seen = new Set<string>();
    type Ranked = Interest & { popularity: number };
    const results: Interest[] = entitiesOf(body)
      .map((e): Ranked | null => {
        const kind = (e.types?.[0] ?? "").replace("urn:entity:", "") as InterestKind;
        if (!KINDS.includes(kind)) return null;
        const year = e.properties?.release_year ?? e.properties?.publication_year;
        return {
          id: e.entity_id,
          name: e.name,
          kind,
          image: e.properties?.image?.url,
          year: typeof year === "number" ? year : undefined,
          popularity: e.popularity ?? 0,
        };
      })
      .filter((r): r is Ranked => r !== null)
      .sort((x, y) => y.popularity - x.popularity)
      .filter((r) => {
        const key = `${r.kind}:${r.name.toLowerCase()}:${r.year ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 7)
      .map((r) => ({ id: r.id, name: r.name, kind: r.kind, image: r.image, year: r.year }));
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Qloo search is unavailable right now." }, { status: 502 });
  }
}
