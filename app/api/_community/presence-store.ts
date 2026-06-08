import { randomUUID } from "node:crypto";

import { containers } from "@/app/api/_community/cosmos";
import {
  geoPartitionFor,
  partitionsForBbox,
  pointInBbox,
  snapToArea,
  type Bbox,
} from "@/src/domain/community/geo";
import {
  presenceTtlSeconds,
  type PresenceType,
  type PublicPresence,
  type ValidatedPresence,
} from "@/src/domain/community/presence";
import type { RidingStyle } from "@/src/domain/riding-style";

export type { PublicPresence };

export type PresenceDoc = {
  id: string;
  geoPartition: string;
  userId: string;
  handle: string;
  type: PresenceType;
  lat: number;
  lon: number;
  note: string;
  style: RidingStyle | null;
  isLocalGuide: boolean;
  plannedAt: string | null;
  createdAtMs: number;
  ttl: number;
};

function toPublic(d: PresenceDoc): PublicPresence {
  return {
    id: d.id,
    geoPartition: d.geoPartition,
    userId: d.userId,
    handle: d.handle,
    type: d.type,
    lat: d.lat,
    lon: d.lon,
    note: d.note,
    style: d.style,
    isLocalGuide: d.isLocalGuide,
    plannedAt: d.plannedAt,
    createdAtMs: d.createdAtMs,
  };
}

export async function createPresence(
  user: { uid: string; handle: string },
  v: ValidatedPresence,
  nowMs: number
): Promise<PublicPresence> {
  const snapped = snapToArea(v.lat, v.lon);
  const geoPartition = geoPartitionFor(snapped.lat, snapped.lon);
  const doc: PresenceDoc = {
    id: randomUUID(),
    geoPartition,
    userId: user.uid,
    handle: user.handle,
    type: v.type,
    lat: snapped.lat,
    lon: snapped.lon,
    note: v.note,
    style: v.style,
    isLocalGuide: v.isLocalGuide,
    plannedAt: v.plannedAt,
    createdAtMs: nowMs,
    ttl: presenceTtlSeconds(v, nowMs),
  };
  await containers.presence().items.create(doc);
  return toPublic(doc);
}

/** Active presences within a viewport, excluding any blocked users. */
export async function listPresenceInBbox(
  bbox: Bbox,
  blockedUserIds: string[] = []
): Promise<PublicPresence[]> {
  const partitions = partitionsForBbox(bbox);
  const blocked = new Set(blockedUserIds);
  const seen = new Set<string>();
  const out: PublicPresence[] = [];

  await Promise.all(
    partitions.map(async (p) => {
      const { resources } = await containers
        .presence()
        .items.query<PresenceDoc>({
          query: "SELECT * FROM c WHERE c.geoPartition = @p",
          parameters: [{ name: "@p", value: p }],
        })
        .fetchAll();
      for (const d of resources) {
        if (seen.has(d.id)) continue;
        if (blocked.has(d.userId)) continue;
        if (!pointInBbox(d.lat, d.lon, bbox)) continue;
        seen.add(d.id);
        out.push(toPublic(d));
      }
    })
  );

  // Soonest planned first, then most recent "now".
  out.sort((a, b) => {
    if (a.plannedAt && b.plannedAt) return Date.parse(a.plannedAt) - Date.parse(b.plannedAt);
    if (a.plannedAt) return -1;
    if (b.plannedAt) return 1;
    return b.createdAtMs - a.createdAtMs;
  });
  return out;
}

/** Delete a presence the caller owns. Returns false if not found / not theirs. */
export async function deleteOwnPresence(id: string, userId: string): Promise<boolean> {
  const { resources } = await containers
    .presence()
    .items.query<PresenceDoc>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  const doc = resources[0];
  if (!doc || doc.userId !== userId) return false;
  await containers.presence().item(doc.id, doc.geoPartition).delete();
  return true;
}
