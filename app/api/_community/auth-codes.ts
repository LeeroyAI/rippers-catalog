import { createHash, randomInt } from "node:crypto";

import { containers } from "@/app/api/_community/cosmos";

/**
 * One-time sign-in codes, stored in Cosmos (container `authcodes`, partitioned
 * by email, auto-expiring via TTL). Only a hash of the code is stored.
 */

const CODE_TTL_SECONDS = 10 * 60; // 10 minutes
const RESEND_COOLDOWN_MS = 30_000; // min gap between code sends to one email
const MAX_ATTEMPTS = 5;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

function docId(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

type AuthCodeDoc = {
  id: string;
  email: string;
  codeHash: string;
  expiresAtMs: number;
  sentAtMs: number;
  attempts: number;
  ttl: number;
};

/** Create + persist a fresh code. Returns the plaintext code (to email), or a cooldown signal. */
export async function issueCode(
  email: string,
  nowMs: number
): Promise<{ ok: true; code: string } | { ok: false; retryAfterMs: number }> {
  const c = containers.authCodes();
  const id = docId(email);
  try {
    const { resource } = await c.item(id, email).read<AuthCodeDoc>();
    if (resource && nowMs - resource.sentAtMs < RESEND_COOLDOWN_MS) {
      return { ok: false, retryAfterMs: RESEND_COOLDOWN_MS - (nowMs - resource.sentAtMs) };
    }
  } catch {
    /* not found — fine, first request */
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const doc: AuthCodeDoc = {
    id,
    email,
    codeHash: hashCode(email, code),
    expiresAtMs: nowMs + CODE_TTL_SECONDS * 1000,
    sentAtMs: nowMs,
    attempts: 0,
    ttl: CODE_TTL_SECONDS,
  };
  await c.items.upsert(doc);
  return { ok: true, code };
}

/** Verify a submitted code. Consumes it on success. */
export async function consumeCode(
  email: string,
  code: string,
  nowMs: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = containers.authCodes();
  const id = docId(email);
  let doc: AuthCodeDoc | undefined;
  try {
    const { resource } = await c.item(id, email).read<AuthCodeDoc>();
    doc = resource;
  } catch {
    doc = undefined;
  }
  if (!doc) return { ok: false, error: "Request a new code." };
  if (nowMs > doc.expiresAtMs) {
    await c.item(id, email).delete().catch(() => {});
    return { ok: false, error: "Code expired — request a new one." };
  }
  if (doc.attempts >= MAX_ATTEMPTS) {
    await c.item(id, email).delete().catch(() => {});
    return { ok: false, error: "Too many attempts — request a new code." };
  }
  if (hashCode(email, code.trim()) !== doc.codeHash) {
    doc.attempts += 1;
    await c.items.upsert(doc).catch(() => {});
    return { ok: false, error: "Incorrect code." };
  }
  await c.item(id, email).delete().catch(() => {});
  return { ok: true };
}
