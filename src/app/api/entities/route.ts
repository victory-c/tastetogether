import type { NextRequest } from "next/server";

import { entitiesOf, isQlooConfigured, qlooGet } from "@/lib/qloo/client";
import type { QlooInsightsResponse } from "@/lib/qloo/types";
import { allow } from "@/lib/server/rate-limit";

/** Looks up display images for known entity ids (used to hydrate sample duos and shared invite links). */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^[0-9A-Fa-f-]{36}$/.test(id))
    .slice(0, 24);
  if (ids.length === 0 || !isQlooConfigured()) return Response.json({ images: {} });
  if (!allow(request, "entities", 60, 60_000)) return Response.json({ images: {} }, { status: 429 });
  try {
    const body = await qlooGet<QlooInsightsResponse>("/entities", { entity_ids: ids.join(",") });
    const images: Record<string, string> = {};
    for (const e of entitiesOf(body)) {
      const url = e.properties?.image?.url;
      if (url) images[e.entity_id] = url;
    }
    return Response.json({ images });
  } catch {
    return Response.json({ images: {} }, { status: 502 });
  }
}
