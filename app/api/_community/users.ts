import { createHash } from "node:crypto";

import { containers } from "@/app/api/_community/cosmos";

/**
 * Community user records. The document id is a deterministic hash of the email,
 * so get-or-create is a single point read (no cross-partition email scan).
 */

export type CommunityUser = {
  id: string;
  email: string;
  handle: string;
  isLocalGuide: boolean;
  guideAreas: string[];
  blockedUserIds: string[];
  createdAtMs: number;
};

export function userIdForEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

/** Turn an email local-part into a friendly default handle. */
function defaultHandle(email: string): string {
  const local = email.split("@")[0] ?? "rider";
  const cleaned = local.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 20);
  return cleaned || "rider";
}

export async function getOrCreateUser(email: string, nowMs: number): Promise<CommunityUser> {
  const c = containers.users();
  const id = userIdForEmail(email);
  try {
    const { resource } = await c.item(id, id).read<CommunityUser>();
    if (resource) return resource;
  } catch {
    /* not found — create below */
  }
  const user: CommunityUser = {
    id,
    email,
    handle: defaultHandle(email),
    isLocalGuide: false,
    guideAreas: [],
    blockedUserIds: [],
    createdAtMs: nowMs,
  };
  await c.items.upsert(user);
  return user;
}

export async function getUserById(id: string): Promise<CommunityUser | null> {
  try {
    const { resource } = await containers.users().item(id, id).read<CommunityUser>();
    return resource ?? null;
  } catch {
    return null;
  }
}
