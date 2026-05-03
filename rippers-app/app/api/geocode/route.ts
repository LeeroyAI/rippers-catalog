import { NextRequest, NextResponse } from "next/server";

const UA =
  process.env.OSM_USER_AGENT?.trim() || "RippersWeb/1 (+https://github.com/)";

export async function GET(req: NextRequest) {
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
