/**
 * Dynamic "gear for your ride" — built from the rider's actual bike (components,
 * wheel, e-bike) and riding style, not a static list. Tools key off the bike's
 * real drivetrain / brakes / suspension brands (any brand, not just Fox), and
 * protection scales with the discipline. Pure + unit-tested.
 */

import { normaliseDiscipline, parseTravelMm } from "@/src/domain/similar-bikes";
import type { Bike } from "@/src/domain/types";

export type GearItem = { icon: string; name: string; desc: string; url: string };
export type GearSet = { protection: GearItem[]; clothing: GearItem[]; tools: GearItem[] };

/** Spec signals we can read from a catalogue bike or a custom ride's lookup. */
export type RideSpecs = {
  discipline: ReturnType<typeof normaliseDiscipline>;
  travelMm: number | null;
  wheel: string | null;
  isEbike: boolean;
  fork?: string;
  shock?: string;
  drivetrain?: string;
  brakes?: string;
};

const SUS_BRANDS = ["Fox", "RockShox", "Marzocchi", "Öhlins", "Ohlins", "DVO", "Manitou", "X-Fusion", "Cane Creek", "RST", "SR Suntour", "Suntour"];
const DRIVE_BRANDS = ["SRAM", "Shimano", "microSHIFT", "MicroShift", "Box", "TRP"];
const BRAKE_BRANDS = ["Shimano", "SRAM", "Magura", "Hayes", "TRP", "Hope", "Formula", "Trickstuff"];

function detectBrand(text: string | undefined, brands: string[]): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const b of brands) {
    if (lower.includes(b.toLowerCase())) return b === "Ohlins" ? "Öhlins" : b === "Suntour" ? "SR Suntour" : b;
  }
  return null;
}

function shopUrl(q: string): string {
  return `https://www.99bikes.com.au/search?q=${encodeURIComponent(q)}`;
}

/** Build ride specs from a catalogue bike or partial custom-lookup specs + style. */
export function rideSpecsFrom(
  bike: Bike | null,
  opts: { style?: string; isEbike?: boolean; customSpecs?: { category?: string; travel?: string; wheel?: string; suspension?: string } | null }
): RideSpecs {
  if (bike) {
    return {
      discipline: normaliseDiscipline(bike.category, bike.isEbike),
      travelMm: parseTravelMm(bike.travel),
      wheel: bike.wheel ?? null,
      isEbike: Boolean(bike.isEbike),
      fork: bike.fork,
      shock: bike.shock,
      drivetrain: bike.drivetrain,
      brakes: bike.brakes,
    };
  }
  const cs = opts.customSpecs;
  const isEbike = Boolean(opts.isEbike);
  return {
    discipline: normaliseDiscipline(cs?.category ?? opts.style ?? "trail", isEbike),
    travelMm: parseTravelMm(cs?.travel),
    wheel: cs?.wheel ?? null,
    isEbike,
    fork: cs?.suspension,
  };
}

function protectionFor(specs: RideSpecs): GearItem[] {
  const d = specs.discipline;
  const heavy = d === "dh" || d === "enduro" || (specs.travelMm ?? 0) >= 160;
  const mid = d === "trail" || (specs.travelMm ?? 0) >= 130;
  const items: GearItem[] = [];
  if (heavy) {
    items.push({ icon: "helmet", name: "Full-face / convertible helmet", desc: "Bell Super Air R · Troy Lee Stage · Fox Proframe · Giro Tyrant", url: shopUrl("full face mtb helmet") });
    items.push({ icon: "knee", name: "Burlier knee pads", desc: "Leatt AirFlex Pro · 7iDP Sam Hill · G-Form Pro-X3", url: shopUrl("mtb knee pads enduro") });
    items.push({ icon: "elbow", name: "Elbow pads", desc: "Leatt 3DF · 661 Raid · POC Joint VPD", url: shopUrl("mtb elbow pads") });
    items.push({ icon: "back", name: "Back protector", desc: "POC Spine VPD · Leatt 3DF · EVOC Protector vest", url: shopUrl("mtb back protector") });
  } else if (mid) {
    items.push({ icon: "helmet", name: "Trail helmet (MIPS)", desc: "Giro Manifest · Bell Sixer · POC Kortal · Fox Speedframe", url: shopUrl("trail mtb helmet mips") });
    items.push({ icon: "knee", name: "Trail knee pads", desc: "G-Form Pro-X3 · Leatt AirFlex · 661 Recon", url: shopUrl("trail mtb knee pads") });
    items.push({ icon: "gloves", name: "Full-finger gloves", desc: "Giro DND · 100% Ridecamp · Race Face Indy", url: shopUrl("mtb full finger gloves") });
  } else {
    items.push({ icon: "helmet", name: "Lightweight XC/trail helmet", desc: "Giro Aether · POC Octal · Bontrager Circuit · Met Trenta", url: shopUrl("xc mtb helmet") });
    items.push({ icon: "knee", name: "Light knee sleeves (optional)", desc: "G-Form Pro-X3 · Fox Enduro · iXS Flow", url: shopUrl("lightweight mtb knee pads") });
    items.push({ icon: "gloves", name: "Lightweight gloves", desc: "Giro DND · Pearl Izumi · 100% Ridecamp", url: shopUrl("xc mtb gloves") });
  }
  return items;
}

function clothingFor(specs: RideSpecs): GearItem[] {
  const baggy = specs.discipline !== "xc";
  return [
    { icon: "jersey", name: baggy ? "Trail jersey" : "XC jersey", desc: baggy ? "7mesh · Endura MT500 · Patagonia Dirt Roamer · Fox Ranger" : "Rapha Trail · Pearl Izumi · Castelli · MAAP", url: shopUrl(baggy ? "trail mtb jersey" : "xc mtb jersey") },
    { icon: "shorts", name: baggy ? "Baggy shorts + liner" : "Bib + light short", desc: baggy ? "Race Face Indy · Endura MT500 · 100% Airmatic · 7mesh" : "Rapha · Pearl Izumi · Assos · MAAP", url: shopUrl(baggy ? "mtb baggy shorts liner" : "mtb bib shorts") },
    { icon: "gloves", name: "Riding socks + eyewear", desc: "Stance / FIST socks · 100% / Oakley / Smith eyewear", url: shopUrl("mtb socks sunglasses") },
  ];
}

function toolsFor(specs: RideSpecs): GearItem[] {
  const items: GearItem[] = [];

  const drive = detectBrand(specs.drivetrain, DRIVE_BRANDS);
  if (drive) {
    items.push({
      icon: "tool",
      name: `${drive} chain + spare hanger`,
      desc: `Matches your ${specs.drivetrain?.trim() || drive} drivetrain — keep a spare chain, quick-link and derailleur hanger.`,
      url: shopUrl(`${drive} mtb chain`),
    });
  }

  const brake = detectBrand(specs.brakes, BRAKE_BRANDS);
  if (brake) {
    items.push({
      icon: "tool",
      name: `${brake} brake pads + bleed kit`,
      desc: `For your ${specs.brakes?.trim() || brake} brakes — carry spare pads; ${brake === "SRAM" || brake === "Magura" || brake === "Hope" || brake === "Formula" ? "DOT" : "mineral oil"} for bleeds.`,
      url: shopUrl(`${brake} brake pads`),
    });
  }

  const susBrand = detectBrand(specs.fork, SUS_BRANDS) ?? detectBrand(specs.shock, SUS_BRANDS);
  if (susBrand) {
    items.push({
      icon: "tool",
      name: `${susBrand} service kit + shock pump`,
      desc: `Seals/lowers service for your ${[specs.fork, specs.shock].filter(Boolean).join(" / ") || susBrand} + a quality shock pump.`,
      url: shopUrl(`${susBrand} fork service kit`),
    });
  } else {
    items.push({ icon: "tool", name: "Shock pump", desc: "Topeak · RockShox · Fox · Lezyne — set sag to your weight.", url: shopUrl("mtb shock pump") });
  }

  const wheel = specs.wheel ?? "";
  const size = /27\.5|mullet/i.test(wheel) ? "27.5\"/29\" (mullet)" : /29/.test(wheel) ? "29\"" : /24/.test(wheel) ? "24\"" : "your wheel size";
  items.push({
    icon: "tool",
    name: `Tubeless kit + spare tube (${size})`,
    desc: "Stan's / Orange Seal sealant · spare tube + tyre plugs (Dynaplug / Sahmurai) sized for your wheels.",
    url: shopUrl(`tubeless sealant mtb ${/24/.test(wheel) ? "24" : /27\.5|mullet/i.test(wheel) ? "27.5" : "29"}`),
  });

  if (specs.isEbike) {
    items.push({
      icon: "tool",
      name: "E-bike essentials",
      desc: "Spare charger, motor-safe degreaser, and wax-based chain lube (e-bikes wear drivetrains fast).",
      url: shopUrl("ebike charger chain wax"),
    });
  }

  items.push({ icon: "tool", name: "Trail multi-tool", desc: "Crankbrothers M19 · Topeak Hexus · Wolf Tooth — with chain breaker.", url: shopUrl("mtb multi tool") });

  return items;
}

/** The whole gear set for a ride. */
export function gearForRide(
  bike: Bike | null,
  opts: { style?: string; isEbike?: boolean; customSpecs?: { category?: string; travel?: string; wheel?: string; suspension?: string } | null } = {}
): GearSet {
  const specs = rideSpecsFrom(bike, opts);
  return {
    protection: protectionFor(specs),
    clothing: clothingFor(specs),
    tools: toolsFor(specs),
  };
}
