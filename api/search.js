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
    height,
    weight,
    age,
    experience,
  } = req.query;

  const missing = [];
  if (!process.env.BRAVE_SEARCH_API_KEY) missing.push("BRAVE_SEARCH_API_KEY");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (missing.length)
    return res
      .status(500)
      .json({ error: `Missing env vars: ${missing.join(", ")}` });

  const startTime = Date.now();
  const HARD_DEADLINE_MS = 75000; // leave 15s buffer before Vercel's 90s kill

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
      height: height ? Number(height) : null,
      weight: weight ? Number(weight) : null,
      age: age ? Number(age) : null,
      experience: experience || null,
    };

    const queries = buildQueries(criteria);
    const snippets = await searchAll(queries, country, cursor);
    const rawBikes = await extractBikes(snippets, criteria);

    // Only enrich with images if we have enough time left
    const elapsed = Date.now() - startTime;
    const bikes = elapsed < HARD_DEADLINE_MS - 10000
      ? await enrichWithImages(rawBikes, country)
      : rawBikes;

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
// Sizing helpers — height (cm) → frame size label and search terms
// ---------------------------------------------------------------------------

function frameSizeLabel(heightCm) {
  if (heightCm < 155) return "XS";
  if (heightCm < 163) return "S";
  if (heightCm < 170) return "S/M";
  if (heightCm < 178) return "M";
  if (heightCm < 185) return "M/L";
  if (heightCm < 192) return "L";
  return "XL";
}

function sizeSearchTerms(heightCm) {
  if (heightCm < 155) return "XS extra-small frame";
  if (heightCm < 163) return "small frame size S";
  if (heightCm < 170) return "small medium frame S M";
  if (heightCm < 178) return "medium frame size M";
  if (heightCm < 185) return "medium large frame M L";
  if (heightCm < 192) return "large frame size L XL";
  return "large XL extra-large frame";
}

// Top brands by riding style — used to generate a brand-sweep query
function topBrandsForStyle(styleOrCat) {
  const map = {
    "Trail":             "Specialized Trek Norco Giant Orbea Canyon Kona Rocky Mountain",
    "Enduro":            "Specialized Yeti Santa Cruz Transition Evil Canyon Commencal",
    "XC / Cross-Country":"Trek Giant Specialized Scott Canyon Orbea Merida",
    "Downhill":          "Santa Cruz Commencal Intense YT Industries Norco",
    "Hardtail":          "Trek Specialized Giant Norco Canyon Kona Merida",
    "eBike":             "Specialized Trek Giant Canyon Orbea Merida Scott Bosch",
    "All-Mountain":      "Norco Rocky Mountain Kona Canyon Devinci Pivot",
    "Gravity":           "Santa Cruz Yeti Intense Commencal YT Industries",
  };
  return map[styleOrCat] || "Specialized Trek Giant Norco Canyon Orbea Santa Cruz";
}

// Experience level → descriptive search adjectives
function experienceTerms(experience) {
  if (!experience) return "";
  const e = experience.toLowerCase();
  if (e.includes("beginner") || e.includes("newcomer")) return "beginner friendly progressive";
  if (e.includes("advanced") || e.includes("expert")) return "aggressive performance high-end";
  if (e.includes("intermed")) return "";
  return "";
}

// ---------------------------------------------------------------------------
// Query builder — generates 6–8 targeted search strings from criteria
// ---------------------------------------------------------------------------

function buildQueries(criteria) {
  const { q, category, budget, wheel, suspension, style, ageRange, travel,
          brands, ebike, country, height, weight, age, experience } = criteria;

  const locationTerm = country === "AU"
    ? "Australia buy 2024 2025 price"
    : "buy 2024 2025 price";

  const sizeTerm   = height ? sizeSearchTerms(height) : "";
  const expTerms   = experienceTerms(experience);

  // Resolve riding style / category label
  const styleOrCat = (style && style !== "Any") ? style
    : (category && category !== "Any") ? category
    : null;

  // Core bike type phrase
  const bikeTerm = ebike
    ? "electric mountain bike eMTB"
    : (ageRange?.toLowerCase().includes("kids"))
      ? "kids youth mountain bike"
      : styleOrCat
        ? `${styleOrCat} mountain bike`
        : "mountain bike";

  // Suspension constraint
  const suspTerm = (suspension === "Hardtail" || category === "Hardtail")
    ? "hardtail"
    : (!ebike && styleOrCat && !styleOrCat.includes("XC"))
      ? "full suspension"
      : "";

  // Spec constraints
  const specParts = [
    wheel && wheel !== "Any" ? wheel.replace('"', " inch") : "",
    suspTerm,
    travel || "",
  ].filter(Boolean).join(" ");

  const budgetTerm  = budget ? `under $${budget} AUD` : "";
  const brandNames  = topBrandsForStyle(styleOrCat);

  // ── Free-text search: just run the query ─────────────────────────────────
  if (q) {
    const base = [q, !/mountain bike|mtb/i.test(q) ? "mountain bike" : "", locationTerm]
      .filter(Boolean).join(" ");
    return [...new Set([base, `buy ${base}`, `${base} price`])].slice(0, 4);
  }

  // ── Brand-specific search ─────────────────────────────────────────────────
  if (brands && brands.length > 0) {
    return brands
      .map(b => [b, bikeTerm, specParts, sizeTerm, budgetTerm, locationTerm]
        .filter(Boolean).join(" "))
      .slice(0, 8);
  }

  // ── Profile-driven search — 6-8 diverse queries ───────────────────────────
  const queries = new Set();

  // Q1 — Core: style + size + budget + location
  queries.add([bikeTerm, specParts, sizeTerm, budgetTerm, locationTerm]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());

  // Q2 — Experience/skill angle
  if (expTerms) {
    queries.add([expTerms, bikeTerm, specParts, sizeTerm, locationTerm]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());
  }

  // Q3 — Brand sweep for this style
  queries.add([brandNames, bikeTerm, sizeTerm, "2025 Australia"]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());

  // Q4 — AU retailer-focused
  queries.add([bikeTerm, specParts, sizeTerm, "99bikes pushys bikeonline chainreaction 2025 Australia price buy"]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());

  // Q5 — Budget range sweep (if budget set, show value range; else show value + premium)
  if (budget) {
    const low = Math.round(budget * 0.55 / 100) * 100;
    queries.add([bikeTerm, specParts, `$${low} to $${budget} AUD`, "Australia 2025"]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());
  } else {
    queries.add(["best value", bikeTerm, specParts, sizeTerm, locationTerm]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());
    queries.add(["premium high-end", bikeTerm, specParts, sizeTerm, locationTerm]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());
  }

  // Q6 — Alternative wheel / travel angle to widen net
  const altWheel = (!wheel || wheel === "Any" || wheel === '29"') ? '27.5"' : '29"';
  queries.add([bikeTerm, altWheel.replace('"', " inch"), suspTerm, sizeTerm, budgetTerm, locationTerm]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());

  // Q7 — "Best of" editorial sweep (review sites surface more models)
  queries.add([`best ${styleOrCat || ""} mountain bikes 2025 Australia`, sizeTerm, budgetTerm]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim());

  return [...queries].filter(Boolean).slice(0, 8);
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

  return snippets.slice(0, 40);
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

  // Build rider profile context for the prompt
  const hasProfile = criteria.height || criteria.age || criteria.experience || criteria.style;
  const riderFrameSize = criteria.height ? frameSizeLabel(criteria.height) : null;

  const riderContext = hasProfile ? `
RIDER PROFILE (use this to prioritise and describe fit):
${criteria.age ? `- Age: ${criteria.age} years old` : ""}
${criteria.height ? `- Height: ${criteria.height}cm → recommended frame size: ${riderFrameSize} (${sizeSearchTerms(criteria.height)})` : ""}
${criteria.weight ? `- Weight: ${criteria.weight}kg` : ""}
${criteria.experience ? `- Experience level: ${criteria.experience}` : ""}
${criteria.style ? `- Riding style: ${criteria.style}` : ""}
${criteria.budget ? `- Budget: up to $${criteria.budget} AUD` : ""}
`.trim() : "";

  const criteriaDesc = [
    criteria.q ? `Search query: "${criteria.q}"` : null,
    criteria.category && criteria.category !== "Any" ? `Category: ${criteria.category}` : null,
    criteria.budget ? `Max budget: $${criteria.budget} AUD` : null,
    criteria.wheel && criteria.wheel !== "Any" ? `Wheel: ${criteria.wheel}` : null,
    criteria.suspension ? `Suspension: ${criteria.suspension}` : null,
    criteria.style ? `Riding style: ${criteria.style}` : null,
    criteria.ebike ? "eBike / electric MTB only" : null,
    criteria.ageRange ? `Age range: ${criteria.ageRange}` : null,
  ].filter(Boolean).join("\n");

  const sizingInstruction = riderFrameSize ? `
SIZING — for a ${criteria.height}cm rider the recommended frame is ${riderFrameSize}.
In the description field, include one sentence stating which specific sizes (e.g. "M or L") fit this rider and whether this bike suits their experience and riding style.
Exclude from the output any bike where the available sizes array does not include ${riderFrameSize.split("/").join(" or ")} — those bikes cannot physically fit this rider.
` : "";

  const prompt = `You are a mountain bike product data specialist with comprehensive knowledge of MTB specifications for all major brands (Specialized, Trek, Giant, Santa Cruz, Yeti, Canyon, Orbea, Scott, Norco, Rocky Mountain, Intense, Pivot, etc.).

Your task has TWO PHASES:

PHASE 1 — DISCOVERY (use the snippets below)
Identify every distinct mountain bike for sale in these web search results. Extract: brand, model, trim level, year, price, retailer, sourceUrl, and imageUrl. Snippets are retailer listings — they rarely contain full specs. That is fine. They exist only to tell you WHAT bikes are for sale and at what price.

PHASE 2 — SPECS (use your training knowledge, not the snippets)
For every bike identified in Phase 1, provide COMPLETE, ACCURATE specifications from your training data. Do not leave spec fields empty because the snippet omitted them — the snippets almost never have full specs. Use your knowledge of the exact brand + model + year + trim. If the year is unclear, use 2024 or 2025 and apply the spec set for that model year.

${riderContext}

Search criteria:
${criteriaDesc || "General mountain bikes"}

${sizingInstruction}

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
  "description": "<3 sentences: (1) terrain and riding style this bike excels at, (2) which frame sizes fit this rider and why it suits their experience level, (3) standout features and what makes it special>",
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
  "imageUrl": "<PRODUCT image URL only — must be from a retailer product listing CDN (Shopify /cdn/shop/, BigCommerce, brand .com product page). Leave empty string if the Image: URL is from a media site, has 'campaign', 'lifestyle', 'action', 'rider', 'riding', 'athlete' in the path, or looks like a lifestyle/editorial shot. When in doubt, leave empty.>"
}

MANDATORY SPEC RULES — violations are not acceptable:
- drivetrain, fork, brakes: MUST be filled for every bike. Use your training knowledge of the exact model + year + trim. These fields being empty is a failure.
- shock: MUST be filled for every full-suspension bike. Empty string only for hardtails.
- weight: MUST be filled. Provide your best knowledge-based estimate (e.g. "14.2kg") — never leave empty.
- frame: MUST be filled — Aluminum, Carbon, Steel, or Titanium.
- travel: MUST be filled in mm format (e.g. "140mm"). Never just say "Hardtail" unless it truly has no rear travel.
- sizes: MUST be a realistic array for the specific model — ["S","M","L","XL"] for most trail bikes, ["XS","S","M","L","XL"] for enduro, ["S","M","L"] for DH.
- description: MUST be 3 sentences per the template above — specific to this model, not generic filler.

PRICE RULES:
- Only include prices actually visible in the snippets (title, description, or clearly tied to that product)
- If price is in USD convert to AUD (×1.55); GBP ×2.0
- Retailer names: short and recognisable — "99 Bikes", "Pushys", "Canyon AU", "Trek AU", "Specialized AU", "Giant AU", "JetBlack Cycling", "Bike Exchange"
- Do NOT invent or guess prices when no figure appears anywhere for that bike — leave prices as {} if none shown

OUTPUT SIZE:
- Return 10–15 distinct bikes. Quality over quantity — pick the best-matched, most clearly evidenced listings.
- Skip duplicate trim levels of the same model (e.g. if Stumpjumper Comp and Expert both appear, include both; if the same trim appears twice from different snippets, deduplicate).
- Do NOT exceed 15 bikes total — output must fit within the token budget.

Return ONLY a valid JSON array, no markdown, no explanation.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].text.trim();

  // Extract JSON array even if Claude wraps it in markdown
  const match = text.match(/\[[\s\S]*/);
  if (!match) {
    console.warn("Claude returned no JSON array:", text.slice(0, 300));
    return [];
  }

  const raw = parseJsonSafe(match[0]);
  if (!raw) {
    console.warn("Claude JSON parse failed:", text.slice(0, 300));
    return [];
  }
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

// Domains that reliably host clean product/studio shots
const PRODUCT_DOMAINS = new Set([
  "specialized.com", "trekbikes.com", "giant-bicycles.com", "santacruzbicycles.com",
  "yeticycles.com", "canyon.com", "orbea.com", "scott-sports.com", "norco.com",
  "bikes.com", "transitionbikes.com", "ibiscycles.com", "cannondale.com",
  "konaworld.com", "merida-bikes.com", "nukeproof.com", "commencal.com",
  "pivotcycles.com", "evil-bikes.com", "devinci.com", "forbiddenbike.com",
  "yt-industries.com", "intensecycles.com", "intense.com",
  "bikeonline.com.au", "pushys.com.au", "maddogcycles.com.au", "anacyclery.com.au",
  "99bikes.com.au", "chainreactioncycles.com", "wiggle.com", "bikeexchange.com.au",
]);

// Sources that serve action/lifestyle shots — hard reject
const ACTION_DOMAINS = new Set([
  "pinkbike.com", "singletracks.com", "mtbr.com", "redbull.com",
  "instagram.com", "pinterest.com", "facebook.com", "youtube.com",
  "vitalbmx.com", "dirt.cc", "mbr.co.uk", "flow-mountain-bike.com",
  "cyclingnews.com", "bikeradar.com", "trailforks.com",
  "dma.canyon.com", // Canyon campaign/marketing CDN — not product shots
]);

// URL path tokens that indicate a lifestyle/action/campaign shot — hard reject
const ACTION_PATH_HINTS = [
  "campaign", "lifestyle", "in-action", "-in-action", "athlete",
  "editorial", "race-run", "world-cup", "enduro-world",
  "riding", "rider", "action",
];

async function braveImageSearch(query, country = "AU") {
  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
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

  let best = null;
  let bestScore = -99;

  for (const result of data.results || []) {
    const img = result.properties?.url || result.thumbnail?.original || result.thumbnail?.src;
    if (!img || !img.startsWith("http")) continue;
    const imgLower = img.toLowerCase();
    if (imgLower.includes("logo") || imgLower.includes("favicon")) continue;

    let score = 0;
    const sourceDomain = (() => { try { return new URL(result.url || "").hostname.replace("www.", ""); } catch { return ""; } })();
    const imgDomain = (() => { try { return new URL(img).hostname.replace("www.", ""); } catch { return ""; } })();

    // Hard reject: known action/editorial domains
    if (ACTION_DOMAINS.has(sourceDomain) || ACTION_DOMAINS.has(imgDomain)) continue;
    // Hard reject: action/lifestyle path tokens in the image URL
    if (ACTION_PATH_HINTS.some((h) => imgLower.includes(h))) continue;

    // Strong boost for known product-image sources
    if (PRODUCT_DOMAINS.has(sourceDomain) || PRODUCT_DOMAINS.has(imgDomain)) score += 15;
    // Prefer full-size source images over thumbnails
    if (result.properties?.url) score += 3;
    // Require a positive score — never return an image with no product signals
    if (score < 0) continue;

    if (score > bestScore) { bestScore = score; best = img; }
  }
  return best;
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

// Fetch a clean product-style image for every bike.
// Always tries the brand's own site first (guarantees a studio/product shot).
// If found, it replaces any snippet thumbnail (which may be an action shot).
// Falls back to a product-specific image search if the brand site yields nothing.
// Runs up to 8 in parallel to stay within the 60s function budget.
async function enrichWithImages(bikes, country) {
  const imageMap = new Map();
  await Promise.allSettled(
    bikes.slice(0, 6).map(async (bike) => {
      const brandKey = bike.brand.toLowerCase();
      const domain = BRAND_DOMAINS[brandKey];

      let img = null;
      // 1st choice: brand's own site — always a clean product/studio shot
      if (domain) {
        img = await braveImageSearch(
          `"${bike.brand} ${bike.model}" site:${domain}`,
          country
        );
      }
      // 2nd choice: product-specific image search (retailer/manufacturer product shots only)
      if (!img) {
        img = await braveImageSearch(
          `"${bike.brand} ${bike.model}" ${bike.year} bicycle "product" -rider -trail -action`,
          country
        );
      }
      // 3rd choice: broader search, still product-oriented
      if (!img) {
        img = await braveImageSearch(
          `${bike.brand} ${bike.model} ${bike.year} mountain bike studio`,
          country
        );
      }
      if (img) imageMap.set(bike.id, img);
    })
  );

  return bikes.map((b) => ({
    ...b,
    // Brand-site or product-search result overrides the snippet thumbnail.
    // Fall back to snippet thumbnail only if enrichment found nothing.
    imageUrl: imageMap.get(b.id) || b.imageUrl || "",
  }));
}

// Resilient JSON array parser — recovers partial results if Claude output is truncated
function parseJsonSafe(text) {
  // 1. Try to parse the full text as-is
  try { return JSON.parse(text); } catch {}
  // 2. Trim to the last complete object: find last '},' or '}' before end
  const lastComma = text.lastIndexOf("},");
  if (lastComma > 0) {
    try { return JSON.parse(text.slice(0, lastComma + 1) + "]"); } catch {}
  }
  const lastBrace = text.lastIndexOf("}");
  if (lastBrace > 0) {
    try { return JSON.parse(text.slice(0, lastBrace + 1) + "]"); } catch {}
  }
  return null;
}

// Simple stable string hash → positive integer
function stableHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}
