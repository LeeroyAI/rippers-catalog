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
    q,
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
      q: q || null,
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
    const rawBikes = await extractBikes(snippets, criteria);
    const bikes = await enrichWithImages(rawBikes, country);

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
    q,
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

  // Free-text search drives the primary query when provided
  if (q) {
    baseTerms.push(q);
    // Always append "mountain bike" for context unless the query already implies it
    if (!/mountain bike|mtb|ebike|e-bike/i.test(q)) {
      baseTerms.push("mountain bike");
    }
  } else if (ebike) {
    baseTerms.push("electric mountain bike eMTB");
  } else if (ageRange && ageRange.toLowerCase().includes("kids")) {
    baseTerms.push("kids mountain bike youth bicycle");
  } else {
    baseTerms.push("mountain bike");
  }

  if (
    !q &&
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

  // Free-text: run the exact query + a "buy" variant
  if (q) {
    return [...new Set([base, `buy ${base}`])].slice(0, 4);
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
    criteria.q ? `Search query: "${criteria.q}"` : null,
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

  const prompt = `You are a mountain bike product data specialist with comprehensive knowledge of MTB specifications for all major brands (Specialized, Trek, Giant, Santa Cruz, Yeti, Canyon, Orbea, Scott, Norco, Rocky Mountain, Intense, Pivot, etc.).

Your task has TWO PHASES:

PHASE 1 — DISCOVERY (use the snippets below)
Identify every distinct mountain bike for sale in these web search results. Extract: brand, model, trim level, year, price, retailer, sourceUrl, and imageUrl. Snippets are retailer listings — they rarely contain full specs. That is fine. They exist only to tell you WHAT bikes are for sale and at what price.

PHASE 2 — SPECS (use your training knowledge, not the snippets)
For every bike identified in Phase 1, provide COMPLETE, ACCURATE specifications from your training data. Do not leave spec fields empty because the snippet omitted them — the snippets almost never have full specs. Use your knowledge of the exact brand + model + year + trim. If the year is unclear, use 2024 or 2025 and apply the spec set for that model year.

Search criteria:
${criteriaDesc || "General mountain bikes"}

Web search results:
${snippetText}

For each bike return a JSON object with EXACTLY these fields:

{
  "id": <stable integer — use Math.abs(hash of brand+model+year), must be unique>,
  "brand": "<manufacturer brand name, e.g. Specialized, Trek, Canyon>",
  "model": "<full model name including trim level, e.g. Stumpjumper Comp Carbon, Sight A30, Jeffsy CF Zeb>",
  "year": <model year as integer — extract from snippet or default to 2025>,
  "category": "<one of: Trail, Enduro, XC / Cross-Country, Downhill, All-Mountain, Hardtail, eBike>",
  "wheel": "<one of: 27.5\\", 29\\", Mullet (29/27.5), 26\\">",
  "travel": "<front travel in mm, e.g. 140mm — write Hardtail only if truly no rear suspension>",
  "suspension": "<one of: Full Suspension, Hardtail, Rigid>",
  "frame": "<material — e.g. Aluminum, Carbon, Steel, Titanium>",
  "drivetrain": "<brand + speeds, e.g. Shimano Deore 12-speed, SRAM GX Eagle 12-speed, Shimano XT 12-speed — USE YOUR TRAINING KNOWLEDGE, this field must never be empty>",
  "fork": "<fork brand + full model name, e.g. RockShox Pike Ultimate 140mm, Fox 36 Float Rhythm 150mm — USE YOUR TRAINING KNOWLEDGE, must never be empty for FS bikes>",
  "shock": "<rear shock brand + full model name, e.g. Fox Float DPS, RockShox Super Deluxe Ultimate — empty string ONLY for hardtails — USE YOUR TRAINING KNOWLEDGE>",
  "weight": "<bike weight with rider-ready setup, e.g. 13.8kg — USE YOUR TRAINING KNOWLEDGE, provide a realistic estimate if exact figure not known>",
  "brakes": "<brake brand + model, e.g. Shimano Deore M6100 4-piston, SRAM Code Silver Stealth, TRP Quadiem — USE YOUR TRAINING KNOWLEDGE, must never be empty>",
  "description": "<3 sentences: terrain this bike excels at, who it suits, standout features and what makes it special>",
  "sizes": ["XS","S","M","L","XL"],
  "prices": {"<retailer name>": <price as number in AUD>},
  "wasPrice": <original price if on sale, else null>,
  "inStock": ["<retailer name — only if snippet explicitly indicates in stock>"],
  "sourceUrl": "<product page URL from the snippet>",
  "isEbike": <true if electric, else false>,
  "motorBrand": <null or motor brand, e.g. "Shimano", "Bosch", "Brose", "TQ">,
  "motor": <null or motor model + torque, e.g. "EP8 RS 85Nm", "Performance CX 85Nm">,
  "battery": <null or capacity, e.g. "504Wh", "750Wh", "360Wh">,
  "range": <null or estimated range, e.g. "80km", "120km">,
  "ageRange": <null or age range string for youth bikes, e.g. "Kids 8-12">,
  "imageUrl": "<product image URL from the Image: line of the matching snippet, or empty string if none>"
}

MANDATORY SPEC RULES — violations are not acceptable:
- drivetrain, fork, brakes: MUST be filled for every bike. Use your training knowledge of the exact model + year + trim. These fields being empty is a failure.
- shock: MUST be filled for every full-suspension bike. Empty string only for hardtails.
- weight: MUST be filled. Provide your best knowledge-based estimate (e.g. "14.2kg") — never leave empty.
- frame: MUST be filled — Aluminum, Carbon, Steel, or Titanium.
- travel: MUST be filled in mm format (e.g. "140mm"). Never just say "Hardtail" unless it truly has no rear travel.
- sizes: MUST be a realistic array — ["S","M","L","XL"] for most trail bikes, ["XS","S","M","L","XL"] for enduro, ["S","M","L"] for DH.
- description: MUST be 3 sentences, specific to this model — not generic filler.

PRICE RULES:
- Only include prices actually visible in the snippets (title, description, or clearly tied to that product)
- If price is in USD convert to AUD (×1.55); GBP ×2.0
- Retailer names: short and recognisable — "99 Bikes", "Pushys", "Canyon AU", "Trek AU", "Specialized AU", "Giant AU", "JetBlack Cycling"
- Do NOT invent or guess prices when no figure appears anywhere for that bike — leave prices as {} if none shown

OUTPUT SIZE:
- Include every distinct bike you can justify from the snippets, up to roughly 12–16 rows when the sources mention that many.
- Do not artificially cap the list at a small number (e.g. 3) if more bikes are clearly present in the search results above.

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

// ---------------------------------------------------------------------------
// Brave Image Search — fetches a high-quality product image for a bike
// ---------------------------------------------------------------------------

async function braveImageSearch(query, country = "AU") {
  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("country", country === "AU" ? "AU" : "ALL");
  url.searchParams.set("search_lang", "en");
  url.searchParams.set("safesearch", "strict");
  url.searchParams.set("spellcheck", "0");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!response.ok) return null;
  const data = await response.json();

  // Prefer full-size source image, fall back to thumbnail
  for (const result of data.results || []) {
    const img = result.properties?.url || result.thumbnail?.original || result.thumbnail?.src;
    if (img && img.startsWith("http") && !img.includes("logo") && !img.includes("favicon")) {
      return img;
    }
  }
  return null;
}

// Official brand website domains — used to target product images directly
// from manufacturer sites rather than lifestyle/riding photos.
const BRAND_DOMAINS = {
  "pivot": "pivotcycles.com",
  "specialized": "specialized.com",
  "trek": "trekbikes.com",
  "giant": "giant-bicycles.com",
  "santa cruz": "santacruzbicycles.com",
  "yeti": "yeticycles.com",
  "canyon": "canyon.com",
  "orbea": "orbea.com",
  "scott": "scott-sports.com",
  "norco": "norco.com",
  "rocky mountain": "bikes.com",
  "intense": "intensecycles.com",
  "commencal": "commencal.com",
  "transition": "transitionbikes.com",
  "evil": "evil-bikes.com",
  "ibis": "ibiscycles.com",
  "cannondale": "cannondale.com",
  "kona": "konaworld.com",
  "merida": "merida-bikes.com",
  "nukeproof": "nukeproof.com",
  "devinci": "devinci.com",
  "forbidden": "forbiddenbike.com",
  "yt industries": "yt-industries.com",
  "yt": "yt-industries.com",
};

// After extraction, fetch official brand product images for bikes missing one.
// Tries the brand's own website first; falls back to a general product search.
// Runs up to 8 in parallel to stay within the 60s function budget.
async function enrichWithImages(bikes, country) {
  const missing = bikes.filter((b) => !b.imageUrl || b.imageUrl === "");
  if (missing.length === 0) return bikes;

  const imageMap = new Map();
  await Promise.allSettled(
    missing.slice(0, 8).map(async (bike) => {
      const brandKey = bike.brand.toLowerCase();
      const domain = BRAND_DOMAINS[brandKey];

      let img = null;
      // 1st choice: brand's own site (gives showroom-quality product images)
      if (domain) {
        img = await braveImageSearch(
          `"${bike.brand} ${bike.model}" site:${domain}`,
          country
        );
      }
      // 2nd choice: general product search (retailer/review site product shots)
      if (!img) {
        img = await braveImageSearch(
          `"${bike.brand} ${bike.model}" ${bike.year} mountain bike`,
          country
        );
      }
      if (img) imageMap.set(bike.id, img);
    })
  );

  return bikes.map((b) => ({
    ...b,
    imageUrl: b.imageUrl && b.imageUrl !== "" ? b.imageUrl : imageMap.get(b.id) || "",
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
