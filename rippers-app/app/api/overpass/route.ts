import { NextRequest, NextResponse } from "next/server";

import {
  loadShopsForBbox,
  loadTrailsForBbox,
  OSM_ATTRIBUTION,
  parseOverpassBbox,
} from "@/src/server/overpass";

/** Vercel Pro: allow slow public Overpass instances; Hobby still capped at platform max. */
export const maxDuration = 60;

/**
 * Combined shops + trails (single round-trip). Prefer `/api/overpass/shops` and
 * `/api/overpass/trails` in parallel from the client for granular progress.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const bbox = parseOverpassBbox(body);
  if (!bbox) {
    return NextResponse.json({ error: "Missing bbox" }, { status: 400 });
  }

  try {
    const [shopsR, trailsR] = await Promise.all([loadShopsForBbox(bbox), loadTrailsForBbox(bbox)]);

    if (!shopsR.ok && !trailsR.ok) {
      return NextResponse.json(
        { error: "Overpass unavailable", shops: [], trails: [], attribution: OSM_ATTRIBUTION },
        { status: 502 }
      );
    }

    return NextResponse.json({
      shops: shopsR.shops,
      trails: trailsR.trails,
      attribution: OSM_ATTRIBUTION,
    });
  } catch {
    return NextResponse.json({ error: "Overpass failed", shops: [], trails: [] }, { status: 500 });
  }
}
