import { NextRequest, NextResponse } from "next/server";

const UA =
  process.env.OSM_USER_AGENT?.trim() || "RippersWeb/1 (+https://github.com/)";

/** Build a short "Suburb, State" style label from a Nominatim address object. */
function shortLabel(
  address: Record<string, string> | undefined,
  fallback: string
): string {
  if (!address) return fallback;
  const locality =
    address.suburb ||
    address.town ||
    address.village ||
    address.city ||
    address.hamlet ||
    address.municipality ||
    address.county;
  const region = address.state || address.region;
  const parts = [locality, region].filter(Boolean);
  return parts.length ? parts.join(", ") : fallback;
}

export async function GET(req: NextRequest) {
  const latRaw = req.nextUrl.searchParams.get("lat");
  const lonRaw = req.nextUrl.searchParams.get("lon");

  // Reverse geocode: coordinates -> a friendly area label (used by auto-locate).
  if (latRaw != null && lonRaw != null) {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ results: [] }, { status: 400 });
    }
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: "json",
      zoom: "12",
      addressdetails: "1",
    });
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { "User-Agent": UA },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        return NextResponse.json({ results: [], error: "Reverse geocoder unavailable" }, { status: 502 });
      }
      const row = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const label = shortLabel(row.address, row.display_name?.split(",").slice(0, 2).join(",").trim() || "Near you");
      return NextResponse.json({
        results: [{ id: `rev-${lat},${lon}`, label, lat, lon }],
      });
    } catch {
      return NextResponse.json({ results: [], error: "Reverse geocoder failed" }, { status: 500 });
    }
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "10",
    addressdetails: "0",
    countrycodes: "au",
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": UA,
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [], error: "Geocoder unavailable" }, { status: 502 });
    }

    const rows = (await res.json()) as Array<{
      place_id?: number | string;
      lat: string;
      lon: string;
      display_name: string;
    }>;

    const results = rows.map((row, idx) => ({
      id: String(row.place_id ?? `${row.lat},${row.lon},${idx}`),
      label: row.display_name,
      lat: Number(row.lat),
      lon: Number(row.lon),
    }));

    return NextResponse.json({
      results: results.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon)),
    });
  } catch {
    return NextResponse.json({ results: [], error: "Geocoder failed" }, { status: 500 });
  }
}
