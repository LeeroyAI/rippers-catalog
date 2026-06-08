import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Stateless signed-session cookie for the community layer (jose / HS256).
 * Secret comes from COMMUNITY_JWT_SECRET.
 */

export const SESSION_COOKIE = "rippers_community";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type SessionUser = { uid: string; email: string; handle: string };

function secret(): Uint8Array {
  const s = process.env.COMMUNITY_JWT_SECRET;
  if (!s) throw new Error("COMMUNITY_JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, handle: user.handle })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.uid)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Read + verify the session from the request cookies. Returns null when absent/invalid. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.handle !== "string") {
      return null;
    }
    return { uid: payload.sub, email: payload.email, handle: payload.handle };
  } catch {
    return null;
  }
}
