import type { TripTrailLine } from "@/app/trip/TripMapInner";

export type GroupedTrailRow = {
  name: string;
  segments: number;
  kmFromCenter: number;
  centroidLat: number;
  centroidLon: number;
};

/** Collapse OSM ways that share a display name so counts match the Trails tab. */
export function groupTrailsForDisplay(trails: TripTrailLine[]): GroupedTrailRow[] {
  const map = new Map<string, GroupedTrailRow>();
  const isGeneric = (n: string) => {
    const s = n.toLowerCase().trim();
    if (!s) return true;
    if (s.startsWith("mtb trail (grade")) return false;
    return ["trail / path", "path", "track", "trail", "unnamed path"].includes(s);
  };
  const sorted = [...trails].sort((a, b) => a.kmFromCenter - b.kmFromCenter);
  for (const t of sorted) {
    const key = isGeneric(t.name) ? `__generic__${t.id}` : t.name.toLowerCase().trim();
    const ex = map.get(key);
    if (!ex) {
      map.set(key, {
        name: isGeneric(t.name) ? "Unnamed path" : t.name,
        segments: 1,
        kmFromCenter: t.kmFromCenter,
        centroidLat: t.centroidLat,
        centroidLon: t.centroidLon,
      });
    } else {
      map.set(key, { ...ex, segments: ex.segments + 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.kmFromCenter - b.kmFromCenter);
}
