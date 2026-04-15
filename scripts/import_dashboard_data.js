#!/usr/bin/env node
/**
 * import_dashboard_data.js
 *
 * Parses dashboard.html and syncs all bikes, retailers, quotes, and bike images
 * into the Swift data files under Rippers/Data/.
 *
 * Usage:
 *   node scripts/import_dashboard_data.js
 *   node scripts/import_dashboard_data.js --source path/to/dashboard.html
 *
 * Writes:
 *   Rippers/Data/Bikes.swift
 *   Rippers/Data/Retailers.swift
 *   Rippers/Data/BikeImages.swift
 *   Rippers/Data/Quotes.swift
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const sourceFlag = args.indexOf('--source');
const dashboardPath = sourceFlag !== -1 ? args[sourceFlag + 1] : 'dashboard.html';
const dataDir = path.join(__dirname, '..', 'Rippers', 'Data');

if (!fs.existsSync(dashboardPath)) {
  console.error(`Error: dashboard.html not found at: ${dashboardPath}`);
  console.error('Place dashboard.html in the repo root or pass --source <path>');
  process.exit(1);
}

const html = fs.readFileSync(dashboardPath, 'utf8');

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function extractJSON(html, variableName) {
  const pattern = new RegExp(`(?:const|let|var)\\s+${variableName}\\s*=\\s*(\\[.*?\\]);`, 'si');
  const match = html.match(pattern);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.warn(`Warning: failed to parse ${variableName}: ${e.message}`);
    return null;
  }
}

function swift(str) {
  if (str === null || str === undefined) return 'nil';
  return `"${String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function swiftOptional(val) {
  return val != null && val !== '' ? swift(val) : 'nil';
}

function swiftBool(val) {
  return val ? 'true' : 'false';
}

function swiftDouble(val) {
  return val != null ? String(Number(val)) : 'nil';
}

// ---------------------------------------------------------------------------
// Bikes
// ---------------------------------------------------------------------------

function generateBikesSwift(bikes) {
  const entries = bikes.map(b => {
    const prices = Object.entries(b.prices || {})
      .map(([k, v]) => `"${k}": ${Number(v)}`)
      .join(', ');
    const inStock = (b.inStock || []).map(s => `"${s}"`).join(', ');
    const sizes = (b.sizes || []).map(s => `"${s}"`).join(', ');

    return `    Bike(
        id: ${b.id},
        brand: ${swift(b.brand)},
        model: ${swift(b.model)},
        year: ${b.year || 2024},
        category: ${swift(b.category)},
        wheel: ${swift(b.wheel)},
        travel: ${swift(b.travel)},
        suspension: ${swift(b.suspension)},
        frame: ${swift(b.frame)},
        drivetrain: ${swift(b.drivetrain)},
        fork: ${swift(b.fork)},
        shock: ${swift(b.shock)},
        weight: ${swift(b.weight)},
        brakes: ${swiftOptional(b.brakes)},
        description: ${swift(b.description)},
        sizes: [${sizes}],
        prices: [${prices}],
        wasPrice: ${b.wasPrice != null ? Number(b.wasPrice) : 'nil'},
        inStock: [${inStock}],
        sourceUrl: ${swift(b.sourceUrl)},
        isEbike: ${swiftBool(b.isEbike)},
        motorBrand: ${swiftOptional(b.motorBrand)},
        motor: ${swiftOptional(b.motor)},
        battery: ${swiftOptional(b.battery)},
        range: ${swiftOptional(b.range)},
        ageRange: ${swiftOptional(b.ageRange)}
    )`;
  });

  return `import Foundation

public let BIKES: [Bike] = [
${entries.join(',\n')}
]
`;
}

// ---------------------------------------------------------------------------
// Retailers
// ---------------------------------------------------------------------------

function generateRetailersSwift(retailers) {
  const entries = retailers.map(r =>
    `    Retailer(id: ${swift(r.id)}, name: ${swift(r.name)}, color: ${swift(r.color)}, domain: ${swift(r.domain)}, isAustralian: ${swiftBool(r.isAustralian)}, url: ${swift(r.url)})`
  );
  return `import Foundation

public let RETAILERS: [Retailer] = [
${entries.join(',\n')}
]
`;
}

// ---------------------------------------------------------------------------
// Bike images
// ---------------------------------------------------------------------------

function generateBikeImagesSwift(images) {
  const entries = Object.entries(images).map(([id, url]) => `    ${id}: ${swift(url)}`);
  return `import Foundation

public let BIKE_IMAGES: [Int: String] = [
${entries.join(',\n')}
]
`;
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

function generateQuotesSwift(quotes) {
  const entries = quotes.map(q => `    ${swift(q)}`);
  return `import Foundation

public let MTB_QUOTES: [String] = [
${entries.join(',\n')}
]
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let written = 0;

const bikes = extractJSON(html, 'BIKES') || extractJSON(html, 'bikes');
if (bikes) {
  const out = path.join(dataDir, 'Bikes.swift');
  fs.writeFileSync(out, generateBikesSwift(bikes));
  console.log(`✓ Bikes.swift — ${bikes.length} bikes`);
  written++;
} else {
  console.warn('⚠ No BIKES array found in dashboard.html — Bikes.swift not updated');
}

const retailers = extractJSON(html, 'RETAILERS') || extractJSON(html, 'retailers');
if (retailers) {
  const out = path.join(dataDir, 'Retailers.swift');
  fs.writeFileSync(out, generateRetailersSwift(retailers));
  console.log(`✓ Retailers.swift — ${retailers.length} retailers`);
  written++;
} else {
  console.warn('⚠ No RETAILERS array found — Retailers.swift not updated');
}

const images = extractJSON(html, 'BIKE_IMAGES') || extractJSON(html, 'bikeImages');
if (images) {
  const out = path.join(dataDir, 'BikeImages.swift');
  fs.writeFileSync(out, generateBikeImagesSwift(images));
  console.log(`✓ BikeImages.swift — ${Object.keys(images).length} images`);
  written++;
} else {
  console.warn('⚠ No BIKE_IMAGES object found — BikeImages.swift not updated');
}

const quotes = extractJSON(html, 'MTB_QUOTES') || extractJSON(html, 'quotes');
if (quotes) {
  const out = path.join(dataDir, 'Quotes.swift');
  fs.writeFileSync(out, generateQuotesSwift(quotes));
  console.log(`✓ Quotes.swift — ${quotes.length} quotes`);
  written++;
} else {
  console.warn('⚠ No MTB_QUOTES array found — Quotes.swift not updated');
}

if (written === 0) {
  console.error('\nNo data extracted. Make sure dashboard.html exposes BIKES, RETAILERS, BIKE_IMAGES, or MTB_QUOTES as JS variables.');
  process.exit(1);
} else {
  console.log(`\nDone. ${written}/4 files updated. Run 'ruby scripts/generate_xcodeproj.rb' if you added new bikes.`);
}
