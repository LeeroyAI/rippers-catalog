import { NextResponse } from "next/server";

import { communityConfigured } from "@/app/api/_community/cosmos";
import { createPresence, listPresenceInBbox } from "@/app/api/_community/presence-store";
import { getSessionUser } from "@/app/api/_community/session";
import { getUserById } from "@/app/api/_community/users";
import type { Bbox } from "@/src/domain/community/geo";
import { validatePresenceInput, type PresenceInput } from "@/src/domain/community/presence";

export const runtime = "nodejs";

function parseBbox(param: string | null): Bbox | null {
  if (!param) return null;
  const parts = param.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts as [number, number, number, number];
  if (south > north || west > east) return null;
  return { south, west, north, east };
}

export async function GET(req: Request) {
  if (!communityConfigured()) return NextResponse.json({ presences: [] });
  const url = new URL(req.url);
  const bbox = parseBbox(url.searchParams.get("bbox"));
  if (!bbox) {
    return NextResponse.json({ error: "bbox=south,west,north,east required" }, { status: 400 });
  }
  // Span guard: refuse absurdly large viewports (keeps queries cheap).
  if (bbox.north - bbox.south > 6 || bbox.east - bbox.west > 6) {
    return NextResponse.json({ error: "Zoom in to see riders here." }, { status: 400 });
  }

  let blocked: string[] = [];
  const session = await getSessionUser();
  if (session) {
    const me = await getUserById(session.uid);
    blocked = me?.blockedUserIds ?? [];
  }

  try {
    const presences = await listPresenceInBbox(bbox, blocked);
    return NextResponse.json({ presences });
  } catch {
    return NextResponse.json({ error: "Couldn't load riders right now." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!communityConfigured()) {
    return NextResponse.json({ error: "Community is not available yet." }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to share that you're riding here." }, { status: 401 });
  }

  let body: PresenceInput;
  try {
    body = (await req.json()) as PresenceInput;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const now = Date.now();
  const validated = validatePresenceInput(body, now);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const presence = await createPresence({ uid: session.uid, handle: session.handle }, validated.value, now);
    return NextResponse.json({ presence }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Couldn't post that — try again." }, { status: 502 });
  }
}
