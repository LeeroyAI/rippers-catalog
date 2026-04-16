/**
 * api/search.js — Rippers Live Bike Search
 *
 * Deployed as a Vercel serverless function.
 * Accepts search criteria, searches the web via Brave Search API,
 * and uses Claude to extract + structure bike listings into BikeRecord JSON.
 *
 * Environment variables required (set in Vercel project settings):
 *   BRAVE_SEARCH_API_KEY  — https://api.search.brave.com
 *   ANTHROPIC_API_KEY     — https://console.anthropic.com
 */

import Anthropic from "@anthropic-ai/sdk";

const BRAVE_BASE = "https://api.search.brave.com/res/v1/web/search";

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "GET only" });

  const {
    category,
    budget,
    wheel,
    suspension,
    style,
    ageRange,
    travel,
    brands,
    ebike,
    country = "AU",
    cursor,
  } = req.query;

  const missing = [];
  if (!process.env.BRAVE_SEARCH_API_KEY) missing.push("BRAVE_SEARCH_API_KEY");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (missing.length)
    return res
      .status(500)
      .json({ error: `Missing env vars: ${missing.join(", ")}` });

  try {
    const criteria = {
      category,
      budget: budget ? Number(budget) : null,
      wheel,
      suspension,
      style,
      ageRange,
      travel,
      brands: brands ? brands.split(",") : [],
      ebike: ebike === "true",
      country,
    };

    const queries = buildQueries(criteria);
    const snippets = await searchAll(queries, country, cursor);
    const bikes = await extractBikes(snippets, criteria);

    // Cache for 1 hour on CDN, serve stale for 24 hours while revalidating
    res.setHeader(
      "Cache-Control",
      "s-maxage=3600, stale-while-revalidate=86400"
    );
    res.json({
      bikes,
      count: bikes.length,
      queries,
      timestamp: Date.now(),
      source: "live",
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message, source: "error" });
  }
}

// ---------------------------------------------------------------------------
// Query builder — generates targeted search strings from criteria
// ---------------------------------------------------------------------------

function buildQueries(criteria) {
  const {
    category,
    budget,
    wheel,
    suspension,
    style,
    ageRange,
    travel,
    brands,
    ebike,
    country,
  } = criteria;

  const baseTerms = [];

  if (ebike) {
    baseTerms.push("electric mountain bike eMTB");
  } else if (ageRange && ageRange.toLowerCase().includes("kids")) {
    baseTerms.push("kids mountain bike youth bicycle");
  } else {
    baseTerms.push("mountain bike");
  }

  if (
    category &&
    category !== "Any" &&
    category !== "eBike" &&
    category !== "Hardtail"
  ) {
    baseTerms.push(category);
  }
  if (suspension === "Hardtail" || category === "Hardtail") {
    baseTerms.push("hardtail");
  }
  if (wheel && wheel !== "Any") {
    baseTerms.push(wheel.replace('"', " inch"));
  }
  if (travel) {
    baseTerms.push(travel);
  }
  if (budget) {
    baseTerms.push(`under $${budget}`);
  }

  const locationTerm =
    country === "AU"
      ? "Australia buy 2024 2025 price"
      : "buy 2024 2025 price";
  baseTerms.push(locationTerm);

  const base = baseTerms.join(" ");

  // If specific brands requested, generate one query per brand
  if (brands && brands.length > 0) {
    return brands.map((b) => `${b} ${base}`);
  }

  // Otherwise generate several covering different price/style angles
  const queries = [base];
  if (style && style !== "Any") {
    queries.push(`${style} ${base}`);
  }
  if (!budget) {
    queries.push(`${base} best value`);
    queries.push(`${base} premium high end`);
  }

  return [...new Set(queries)].slice(0, 4);
}

// ---------------------------------------------------------------------------
// Brave Search — parallel queries
// ---------------------------------------------------------------------------

async function searchAll(queries, country, cursor) {
  const results = await Promise.allSettled(
    queries.map((q) => braveSearch(q, country, cursor))
  );

  const snippets = [];
  const seen = new Set();

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value.web?.results || []) {
      const key = item.url;
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push({
        url: item.url,
        title: item.title,
        description: item.description || "",
        imageUrl: item.thumbnail?.original || item.thumbnail?.src || "",
      });
    }
  }

  return snippets.slice(0, 30);
}

async function braveSearch(query, country, cursor) {
  const url = new URL(BRAVE_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("country", country === "AU" ? "AU" : "ALL");
  url.searchParams.set("search_lang", "en");
  url.searchParams.set("result_filter", "web");
  if (cursor) url.searchParams.set("offset", cursor);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brave Search ${response.status}: ${text.slice(0, 200)}`);
  }

  return await response.json();
}

// ---------------------------------------------------------------------------
// Claude extraction — structures raw search snippets into BikeRecord JSON
// ---------------------------------------------------------------------------

async function extractBikes(snippets, criteria) {
  if (!snippets.length) return [];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const snippetText = snippets
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}\nURL: ${s.url}${s.imageUrl ? `\nImage: ${s.imageUrl}` : ""}\n${s.description}`.trim()
    )
    .join("\n\n");

  const criteriaDesc = [
    criteria.category && criteria.category !== "Any"
      ? `Category: ${criteria.category}`
      : null,
    criteria.budget ? `Max budget: $${criteria.budget} AUD` : null,
    criteria.wheel && criteria.wheel !== "Any"
      ? `Wheel: ${criteria.wheel}`
      : null,
    criteria.suspension ? `Suspension: ${criteria.suspension}` : null,
    criteria.style ? `Riding style: ${criteria.style}` : null,
    criteria.ebike ? "eBike / electric MTB only" : null,
    criteria.ageRange ? `Age range: ${criteria.ageRange}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a mountain bike product data specialist. Extract individual mountain bike product listings from these web search result snippets.

Search criteria:
${criteriaDesc || "General mountain bikes"}

Web search results:
${snippetText}

Extract every distinct mountain bike product you can identify. For each bike return a JSON object with EXACTLY these fields:

{
  "id": <stable integer — use Math.abs(hash of brand+model+year), must be unique>,
  "brand": "<manufacturer brand name, e.g. Specialized, Trek, Canyon>",
  "model": "<model name including trim level, e.g. Stumpjumper Comp Carbon>",
  "year": <model year as integer, e.g. 2025 — use current year if unknown>,
  "category": "<one of: Trail, Enduro, XC / Cross-Country, Downhill, All-Mountain, Hardtail, eBike>",
  "wheel": "<one of: 27.5\\", 29\\", Mullet (29/27.5), 26\\">",
  "travel": "<front travel, e.g. 140mm — use Hardtail if no rear suspension>",
  "suspension": "<one of: Full Suspension, Hardtail, Rigid>",
  "frame": "<e.g. Aluminum, Carbon, Steel>",
  "drivetrain": "<brand + speeds, e.g. Shimano Deore 12-speed, SRAM NX Eagle 12-speed — use your knowledge of this model if not in snippet>",
  "fork": "<fork brand + model, e.g. RockShox Pike RCT3, Fox 36 Rhythm — use your knowledge of this model if not in snippet>",
  "shock": "<rear shock brand + model, e.g. Fox Float DPS, RockShox Deluxe — empty string only if hardtail — use your knowledge if not in snippet>",
  "weight": "<bike weight in kg, e.g. 14.2kg — use your knowledge of this model year if not in snippet>",
  "brakes": "<brake brand + model, e.g. Shimano MT520 4-piston, SRAM Code R — use your knowledge if not in snippet>",
  "description": "<2-3 sentences: what terrain this bike excels at, who it suits, standout features>",
  "sizes": ["XS","S","M","L","XL"],
  "prices": {"<retailer name>": <price as number in AUD>},
  "wasPrice": <original price if on sale, else null>,
  "inStock": ["<same retailer name as in prices — only if snippet indicates stock available>"],
  "sourceUrl": "<direct product page URL from the snippet>",
  "isEbike": <true if electric, else false>,
  "motorBrand": <null or motor brand string, e.g. "Shimano", "Bosch", "Brose">,
  "motor": <null or motor model, e.g. "EP8 85Nm", "Performance CX 85Nm">,
  "battery": <null or capacity string, e.g. "504Wh", "750Wh">,
  "range": <null or estimated range, e.g. "80km">,
  "ageRange": <null or "Kids 8-12" for youth bikes>,
  "imageUrl": "<product image URL from the Image: line of the matching snippet, or empty string>"
}

CRITICAL RULES FOR SPEC FIELDS:
- shock, brakes, fork, drivetrain, weight: NEVER leave these empty for full-suspension bikes. Use your training knowledge of the specific brand/model/year/trim to fill them in accurately if the snippet doesn't mention them.
- sizes: always return a realistic array for this type of bike (e.g. ["S","M","L","XL"] for adult trail bikes, ["XS","S","M","L","XL"] for enduro, ["S","M","L"] for DH)
- If you know the spec from your training data, use it — do not leave fields blank just because the snippet omitted them

PRICE RULES:
- Only include prices actually mentioned in the snippets
- If price is in USD, convert to AUD (multiply by 1.55); GBP multiply by 2.0
- Retailer name must be a short recognisable name: "99 Bikes", "Pushys", "Canyon AU", "Trek AU", "Specialized AU"
- Do NOT invent prices — leave prices as {} if none mentioned

Return ONLY a valid JSON array, no markdown, no explanation.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].text.trim();

  // Extract JSON array even if Claude wraps it in markdown
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    console.warn("Claude returned no JSON array:", text.slice(0, 300));
    return [];
  }

  const raw = JSON.parse(match[0]);
  return raw
    .filter((b) => b && b.brand && b.model)
    .map((b) => ({
      ...b,
      id: b.id || stableHash(b.brand + b.model + b.year),
      year: b.year || new Date().getFullYear(),
      sizes: Array.isArray(b.sizes) ? b.sizes : ["S", "M", "L", "XL"],
      prices: b.prices || {},
      inStock: b.inStock || [],
      isEbike: !!b.isEbike,
    }));
}

// Simple stable string hash → positive integer
function stableHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}
