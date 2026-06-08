import { NextResponse } from "next/server";

import { consumeCode, isValidEmail, normalizeEmail } from "@/app/api/_community/auth-codes";
import { communityConfigured } from "@/app/api/_community/cosmos";
import { setSessionCookie } from "@/app/api/_community/session";
import { getOrCreateUser } from "@/app/api/_community/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!communityConfigured()) {
    return NextResponse.json({ error: "Community sign-in is not available yet." }, { status: 503 });
  }
  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizeEmail(body.email ?? "");
  const code = (body.code ?? "").trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const now = Date.now();
  const result = await consumeCode(email, code, now);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const user = await getOrCreateUser(email, now);
  await setSessionCookie({ uid: user.id, email: user.email, handle: user.handle });
  return NextResponse.json({
    user: { handle: user.handle, isLocalGuide: user.isLocalGuide },
  });
}
