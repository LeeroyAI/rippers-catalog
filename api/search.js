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
        `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.description}`.trim()
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

Extract every distinct mountain bike product you can identify. For each bike return a JSON object with EXACTLY these fields (use empty string "" for unknown strings, null for unknown optional values, and sensible defaults):

{
  "id": <stable integer — use Math.abs(hash of brand+model), must be unique>,
  "brand": "<manufacturer brand name, e.g. Specialized, Trek, Canyon>",
  "model": "<model name including trim level, e.g. Stumpjumper Comp Carbon>",
  "year": <model year as integer, e.g. 2024 — use current year if unknown>,
  "category": "<one of: Trail, Enduro, XC / Cross-Country, Downhill, All-Mountain, Hardtail, eBike>",
  "wheel": "<one of: 27.5\\", 29\\", Mullet (29/27.5), 26\\">",
  "travel": "<e.g. 140mm or Hardtail>",
  "suspension": "<one of: Full Suspension, Hardtail, Rigid>",
  "frame": "<e.g. Aluminum, Carbon, Steel>",
  "drivetrain": "<e.g. Shimano Deore 12-speed, SRAM NX Eagle>",
  "fork": "<e.g. RockShox Pike RCT3, Fox 36 Rhythm>",
  "shock": "<rear shock name or empty string if hardtail>",
  "weight": "<e.g. 14.2kg or empty string>",
  "brakes": "<e.g. Shimano MT520 4-piston or empty string>",
  "description": "<1-2 sentences about what this bike is good for>",
  "sizes": ["XS","S","M","L","XL"],
  "prices": {"<retailer name>": <price as number in AUD>},
  "wasPrice": <original price if on sale, else null>,
  "inStock": ["<same retailer name as in prices if available>"],
  "sourceUrl": "<direct product page URL>",
  "isEbike": <true if electric, else false>,
  "motorBrand": <null or "Bosch" etc>,
  "motor": <null or "Performance CX 85Nm" etc>,
  "battery": <null or "500Wh" etc>,
  "range": <null or "80km" etc>,
  "ageRange": <null or "Kids 8-12" for youth bikes>
}

Rules:
- Only include real, purchasable bikes you can identify from the snippets
- Only include bikes relevant to the criteria
- If price is mentioned in another currency, convert to AUD (multiply USD by 1.55, GBP by 2.0)
- Retailer name in prices/inStock must be a short name like "99 Bikes", "Pushys", "Canyon", "Trek"
- Do NOT invent prices — only use prices actually mentioned in the snippets
- Return ONLY a valid JSON array, no markdown, no explanation`;

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
