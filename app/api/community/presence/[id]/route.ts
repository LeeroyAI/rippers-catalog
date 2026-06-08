import { NextResponse } from "next/server";

import { communityConfigured } from "@/app/api/_community/cosmos";
import { deleteOwnPresence } from "@/app/api/_community/presence-store";
import { getSessionUser } from "@/app/api/_community/session";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!communityConfigured()) {
    return NextResponse.json({ error: "Community is not available yet." }, { status: 503 });
  }
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  try {
    const removed = await deleteOwnPresence(id, session.uid);
    if (!removed) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't remove that — try again." }, { status: 502 });
  }
}
