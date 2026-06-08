import { NextResponse } from "next/server";

import { getSessionUser } from "@/app/api/_community/session";
import { getUserById } from "@/app/api/_community/users";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ user: null });
  const user = await getUserById(session.uid);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      uid: user.id,
      handle: user.handle,
      isLocalGuide: user.isLocalGuide,
      guideAreas: user.guideAreas,
    },
  });
}
