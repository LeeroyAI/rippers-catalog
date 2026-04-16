#!/usr/bin/env node
/**
 * fetch_live_catalog.js
 *
 * Runs as a daily GitHub Action to refresh Rippers/catalog.json with
 * live bike listings fetched from Brave Search and structured by Claude.
 *
 * Uses the same logic as api/search.js but runs as a batch job across
 * multiple search queries to build a comprehensive catalog snapshot.
 *
 * Environment variables required:
 *   BRAVE_SEARCH_API_KEY
 *   ANTHROPIC_API_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const CATALOG_PATH = path.join(REPO_ROOT, "Rippers", "catalog.json");
const BRAVE_BASE = "https://api.search.brave.com/res/v1/web/search";

const SEARCH_QUERIES = [
  // Trail & All-Mountain
  "trail mountain bike 2024 2025 Australia buy price site:99bikes.com.au OR site:pushys.com.au OR site:manic.com.au",
  "all mountain bike 2024 2025 Australia buy price",
  // Enduro & Gravity
  "enduro mountain bike 2024 2025 Australia buy price",
  "downhill mountain bike 2024 2025 full suspension Australia",
  // XC
  "cross country mountain bike XC 2024 2025 Australia buy price",
  // Hardtail
  "hardtail mountain bike 2024 2025 Australia buy price",
  // eBike
  "electric mountain bike eMTB 2024 2025 Australia buy price",
  "eMTB Bosch Shimano EP8 2024 2025 Australia",
  // Budget picks
  "mountain bike under 2000 Australia 2024 2025",
  "mountain bike under 4000 Australia 2024 2025 best value",
  // Kids
  "kids youth mountain bike 2024 2025 Australia",
  // Premium
  "carbon mountain bike premium 2024 2025 Australia",
];

async function braveSearch(query) {
  const url = new URL(BRAVE_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("country", "AU");
  url.searchParams.set("search_lang", "en");
  url.searchParams.set("result_filter", "web");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn(`Brave Search ${response.status} for "${query}": ${text.slice(0, 100)}`);
    return [];
  }

  const data = await response.json();
  return data.web?.results || [];
}

async function extractBikes(snippets, queryContext) {
  if (!snippets.length) return [];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const snippetText = snippets
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.description || ""}`.trim())
    .join("\n\n");

  const prompt = `You are a mountain bike product data specialist. Extract individual mountain bike product listings from these web search results for the Australian market.

Search context: ${queryContext}

Web search results:
${snippetText}

Extract every distinct mountain bike product you can identify. For each bike return a JSON object with EXACTLY these fields:

{
  "id": <stable integer — use Math.abs(hash of brand+model), must be unique>,
  "brand": "<manufacturer brand name>",
  "model": "<model name including trim level>",
  "year": <model year as integer, e.g. 2024>,
  "category": "<one of: Trail, Enduro, XC / Cross-Country, Downhill, All-Mountain, Hardtail, eBike>",
  "wheel": "<one of: 27.5\\", 29\\", Mullet (29/27.5), 26\\", 24\\">",
  "travel": "<e.g. 140mm or Hardtail>",
  "suspension": "<one of: Full Suspension, Hardtail, Rigid>",
  "frame": "<e.g. Aluminum, Carbon, Steel>",
  "drivetrain": "<e.g. Shimano Deore 12-speed>",
  "fork": "<e.g. RockShox Pike>",
  "shock": "<rear shock or empty string if hardtail>",
  "weight": "<e.g. 14.2kg or empty string>",
  "brakes": "<e.g. Shimano MT520 or empty string>",
  "description": "<1-2 sentences about what this bike is for>",
  "sizes": ["XS","S","M","L","XL"],
  "prices": {"<retailer>": <price in AUD>},
  "wasPrice": <original price if on sale, else null>,
  "inStock": ["<retailer>"],
  "sourceUrl": "<product page URL>",
  "isEbike": <true if electric>,
  "motorBrand": null,
  "motor": null,
  "battery": null,
  "range": null,
  "ageRange": null
}

Rules:
- Only include real, purchasable bikes
- If price is in another currency, convert to AUD (USD × 1.55, GBP × 2.0)
- Retailer name must be short: "99 Bikes", "Pushys", "Canyon", "Trek", "Specialized"
- Do NOT invent prices
- Return ONLY a valid JSON array, no markdown, no explanation`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].text.trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]).filter((b) => b && b.brand && b.model);
  } catch (e) {
    console.warn("JSON parse error:", e.message);
    return [];
  }
}

function stableHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function normalizeBike(b) {
  return {
    id: b.id || stableHash(b.brand + b.model + (b.year || 2025)),
    brand: b.brand ?? "",
    model: b.model ?? "",
    year: b.year ?? 2025,
    category: b.category ?? "",
    wheel: b.wheel ?? "",
    travel: b.travel ?? "",
    suspension: b.suspension ?? "",
    frame: b.frame ?? "",
    drivetrain: b.drivetrain ?? "",
    fork: b.fork ?? "",
    shock: b.shock ?? "",
    weight: b.weight ?? "",
    brakes: b.brakes ?? "",
    description: b.description ?? "",
    sizes: b.sizes ?? ["S", "M", "L", "XL"],
    prices: b.prices ?? {},
    wasPrice: b.wasPrice ?? null,
    inStock: b.inStock ?? [],
    sourceUrl: b.sourceUrl ?? "",
    isEbike: !!b.isEbike,
    motorBrand: b.motorBrand ?? null,
    motor: b.motor ?? null,
    battery: b.battery ?? null,
    range: b.range ?? null,
    ageRange: b.ageRange ?? null,
  };
}

async function main() {
  if (!process.env.BRAVE_SEARCH_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error("Missing BRAVE_SEARCH_API_KEY or ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const allBikes = new Map(); // id → bike
  const seen = new Set(); // dedup by url

  // Process queries in batches of 3 to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < SEARCH_QUERIES.length; i += batchSize) {
    const batch = SEARCH_QUERIES.slice(i, i + batchSize);
    console.log(`\nProcessing queries ${i + 1}–${i + batch.length}...`);

    const results = await Promise.allSettled(batch.map((q) => braveSearch(q)));

    for (let j = 0; j < results.length; j++) {
      if (results[j].status !== "fulfilled") continue;
      const items = results[j].value;
      const snippets = items
        .filter((item) => {
          if (seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        })
        .slice(0, 10)
        .map((item) => ({
          url: item.url,
          title: item.title,
          description: item.description || "",
        }));

      if (!snippets.length) continue;

      const bikes = await extractBikes(snippets, batch[j]);
      for (const bike of bikes) {
        const normalized = normalizeBike(bike);
        // Merge: if we already have this bike, merge prices
        const existing = allBikes.get(normalized.id);
        if (existing) {
          Object.assign(existing.prices, normalized.prices);
          for (const r of normalized.inStock) {
            if (!existing.inStock.includes(r)) existing.inStock.push(r);
          }
        } else {
          allBikes.set(normalized.id, normalized);
        }
      }
      console.log(`  Query "${batch[j].slice(0, 60)}..." → ${bikes.length} bikes`);

      // Small delay to be polite to APIs
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const catalog = Array.from(allBikes.values());
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`\n✓ catalog.json updated — ${catalog.length} bikes`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
