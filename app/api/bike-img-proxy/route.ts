import { NextRequest, NextResponse } from "next/server";

import {
  getMemoized,
  setMemoized,
  transparentizeWhiteBackground,
} from "@/app/api/_image/transparentize";

export const runtime = "nodejs";

const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

/**
 * Host suffixes allowed for dynamic hero images (retailer CDNs + editorial).
 * Tighten over time if abuse appears.
 */
const ALLOWED_HOST_SUFFIXES = [
  "vitalmtb.com",
  "sefiles.net",
  "bikesonline.com.au",
  "bikesonline.com",
  "99bikes.com.au",
  "pushys.com.au",
  "bikes.com",
  "trekbikes.com",
  "giant-bicycles.com",
  "specialized.com",
  "canyon.com",
  "yt-industries.com",
  "marinbikes.com",
  "norco.com",
  "scott-sports.com",
  "santacruzbicycles.com",
  "transitionbikes.com",
  "commencal-store.com",
  "merida-bikes.com",
  "m-c-g.net",
  "spiritedcyclist.com",
  "tritoncycles.co.uk",
  "shopify.com",
  "shopifycdn.net",
  "cdn.shopify.com",
  "bigcommerce.com",
  "cloudinary.com",
  "imgix.net",
  "amazonaws.com",
  "cloudfront.net",
  "wikipedia.org",
  "wikimedia.org",
  "brave.com",
  "silverback-world.com",
  "silverbackbikes.com",
  "silverbackbikes.com.au",
  "silverbackbicycles.co.za",
  "k-ozcycling.com.au",
  "bicycle.net.au",
  "bicycleonline.com.au",
  "bikebug.com.au",
  "bikeexchange.com.au",
  "torpedo7.com.au",
  "ucarecdn.com",
  "ctfassets.net",
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
  "wp.com",
  "googleusercontent.com",
  "gstatic.com",
];

function isAllowedImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return false;
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/**
 * Proxies arbitrary HTTPS product hero URLs with the same headers trick as `/api/bike-img/[id]`.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw?.trim()) {
    return new NextResponse(null, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (url.protocol !== "https:") {
    return new NextResponse(null, { status: 400 });
  }

  if (!isAllowedImageHost(url.hostname)) {
    return new NextResponse(null, { status: 403 });
  }

  // `?raw=1` opts out of the white-background knockout (serve upstream as-is).
  const rawPassthrough = req.nextUrl.searchParams.get("raw") === "1";
  const memoKey = `url:${url.toString()}`;

  if (!rawPassthrough) {
    const memo = getMemoized(memoKey);
    if (memo) {
      return new NextResponse(memo.buffer as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": memo.contentType, "Cache-Control": CACHE_CONTROL },
      });
    }
  }

  const origin = url.origin;

  try {
    const upstream = await fetch(url.toString(), {
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
    if (!contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 415 });
    }

    const body = Buffer.from(await upstream.arrayBuffer());

    // Knock out a white product-photo background. `null` => serve original.
    if (!rawPassthrough) {
      const transparent = await transparentizeWhiteBackground(body);
      setMemoized(memoKey, transparent);
      if (transparent) {
        return new NextResponse(transparent.buffer as unknown as BodyInit, {
          status: 200,
          headers: { "Content-Type": transparent.contentType, "Cache-Control": CACHE_CONTROL },
        });
      }
    }

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
