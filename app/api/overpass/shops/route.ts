import { NextRequest, NextResponse } from "next/server";

import {
  loadShopsForBbox,
  OSM_ATTRIBUTION,
  parseOverpassBbox,
} from "@/src/server/overpass";

export const maxDuration = 60;

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
    const { ok, shops } = await loadShopsForBbox(bbox);
    if (!ok) {
      return NextResponse.json({ error: "Overpass unavailable", shops: [], attribution: OSM_ATTRIBUTION }, { status: 502 });
    }
    return NextResponse.json({ shops, attribution: OSM_ATTRIBUTION });
  } catch {
    return NextResponse.json({ error: "Overpass failed", shops: [] }, { status: 500 });
  }
}
