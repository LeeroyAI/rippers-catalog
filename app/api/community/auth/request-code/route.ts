import { NextResponse } from "next/server";

import { issueCode, isValidEmail, normalizeEmail } from "@/app/api/_community/auth-codes";
import { communityConfigured } from "@/app/api/_community/cosmos";
import { emailConfigured, sendSignInCode } from "@/app/api/_community/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!communityConfigured() || !emailConfigured()) {
    return NextResponse.json({ error: "Community sign-in is not available yet." }, { status: 503 });
  }
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizeEmail(body.email ?? "");
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const now = Date.now();
  const issued = await issueCode(email, now);
  if (!issued.ok) {
    return NextResponse.json(
      { error: "Please wait a moment before requesting another code." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(issued.retryAfterMs / 1000)) } }
    );
  }

  try {
    await sendSignInCode(email, issued.code);
  } catch {
    return NextResponse.json({ error: "Couldn't send the code — try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
