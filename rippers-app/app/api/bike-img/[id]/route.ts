import { NextResponse } from "next/server";

import { bikeImageUrlForId } from "@/src/data/bike-images";

export const runtime = "nodejs";

/**
 * Proxies authenticated-looking server fetches so retailer CDNs deliver hero art
 * (many block empty-referrer browser requests → grey broken tile + alt bleed-through).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    return new NextResponse(null, { status: 404 });
  }

  const url = bikeImageUrlForId(id);
  if (!url) {
    return new NextResponse(null, { status: 404 });
  }

  const origin = new URL(url).origin;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121 Safari/537.36 RippersHero/1",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        Referer: `${origin}/`,
      },
      next: { revalidate: 86_400 },
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const contentType =
      upstream.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";

    const body = Buffer.from(await upstream.arrayBuffer());

    /* Stream nothing unusual — CDN responses are modest hero sizes */
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
