import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;
export const runtime = "nodejs";

const BRAVE_BASE = "https://api.search.brave.com/res/v1/web/search";

type BraveSnippet = { url: string; title: string; description: string; imageUrl: string };

type LookupOk = {
  imageUrl: string | null;
  sourceUrl: string | null;
  specs: Record<string, unknown> | null;
  confidence: number;
};

const memoryCache = new Map<string, { at: number; body: LookupOk }>();
const CACHE_MS = 86_400_000;

async function braveSearch(query: string): Promise<BraveSnippet[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) throw new Error("BRAVE_SEARCH_API_KEY missing");

  const url = new URL(BRAVE_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("country", "AU");
  url.searchParams.set("search_lang", "en");
  url.searchParams.set("result_filter", "web");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brave ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    web?: { results?: Array<{ url: string; title: string; description?: string; thumbnail?: { original?: string; src?: string } }> };
  };

  const out: BraveSnippet[] = [];
  for (const item of json.web?.results ?? []) {
    out.push({
      url: item.url,
      title: item.title,
      description: item.description ?? "",
      imageUrl: item.thumbnail?.original ?? item.thumbnail?.src ?? "",
    });
  }
  return out;
}

function mergeSnippets(a: BraveSnippet[], b: BraveSnippet[], max: number): BraveSnippet[] {
  const seen = new Set<string>();
  const merged: BraveSnippet[] = [];
  for (const s of [...a, ...b]) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    merged.push(s);
    if (merged.length >= max) break;
  }
  return merged;
}

function snippetBlock(snippets: BraveSnippet[]): string {
  return snippets
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}\nURL: ${s.url}${s.imageUrl ? `\nThumb: ${s.imageUrl}` : ""}\n${s.description}`.trim()
    )
    .join("\n\n");
}

function parseJsonFromAssistant(text: string): unknown {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(t);
  if (fence) t = fence[1]!.trim();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    throw new Error("Claude response was not valid JSON");
  }
}

async function extractWithClaude(snippets: BraveSnippet[], brand: string, model: string, year: string): Promise<LookupOk> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const userMessage = [
    `User typed this bike (may include wheel size in the model name):`,
    `Brand: ${brand}`,
    `Model / name line: ${model}`,
    `Year field (may be empty or wrong): ${year || "(none)"}`,
    "",
    "Web search snippets (retailer / editorial pages):",
    snippetBlock(snippets),
    "",
    "Return a SINGLE JSON object (no markdown) with EXACTLY these keys:",
    `{ "confidence": <number 0-1>, "imageUrl": <string|null — direct https URL to a product hero image if visible in snippets; else null>,`,
    `  "sourceUrl": <string|null — best authoritative page URL from snippets for this exact bike; else null>,`,
    `  "specs": {`,
    `    "category": string, "travel": string, "wheel": string, "suspension": string, "frame": string,`,
    `    "drivetrain": string, "fork": string, "shock": string, "weight": string, "brakes": string,`,
    `    "description": string (2 short sentences), "isEbike": boolean,`,
    `    "motor": string|null, "motorBrand": string|null, "battery": string|null, "range": string|null`,
    `  }`,
    `}`,
    "",
    "Rules:",
    "- Prefer specs from your training knowledge for this brand+model (+ year if plausible). Snippets are mainly for imageUrl and sourceUrl.",
    "- If you cannot identify the bike confidently, set confidence below 0.45 and imageUrl/sourceUrl null and specs null.",
    "- imageUrl must be https and look like a real image file or CDN path when present.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system:
        "You output only valid JSON for bike lookup. No markdown fences. If unsure, lower confidence and null out fields.",
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  const parsed = parseJsonFromAssistant(text) as {
    confidence?: number;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    specs?: Record<string, unknown> | null;
  };

  const confidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) ? parsed.confidence : 0;
  const imageUrl = typeof parsed.imageUrl === "string" && parsed.imageUrl.startsWith("https://") ? parsed.imageUrl : null;
  const sourceUrl = typeof parsed.sourceUrl === "string" && parsed.sourceUrl.startsWith("https://") ? parsed.sourceUrl : null;
  const specs = parsed.specs && typeof parsed.specs === "object" ? parsed.specs : null;

  return { imageUrl, sourceUrl, specs, confidence };
}

function cacheKey(brand: string, model: string, year: string): string {
  return `${brand.trim().toLowerCase()}|${model.trim().toLowerCase()}|${year.trim().toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  let body: { brand?: string; model?: string; year?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const brand = String(body.brand ?? "").trim();
  const model = String(body.model ?? "").trim();
  const year = String(body.year ?? "").trim();

  if (!brand && !model) {
    return NextResponse.json({ error: "Missing brand and model" }, { status: 400 });
  }

  const key = cacheKey(brand, model, year);
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json(hit.body, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  }

  try {
    const q1 = [brand, model, year, "mountain bike specifications Australia"].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const q2 = [brand, model, year, "mountain bike review site:vitalmtb.com OR site:bikesonline.com.au"].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    const [r1, r2] = await Promise.all([braveSearch(q1), braveSearch(q2)]);
    const snippets = mergeSnippets(r1, r2, 24);
    if (snippets.length === 0) {
      const empty: LookupOk = { imageUrl: null, sourceUrl: null, specs: null, confidence: 0 };
      memoryCache.set(key, { at: Date.now(), body: empty });
      return NextResponse.json(empty);
    }

    const extracted = await extractWithClaude(snippets, brand, model, year);
    memoryCache.set(key, { at: Date.now(), body: extracted });

    return NextResponse.json(extracted, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    console.error("bike-lookup:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}
