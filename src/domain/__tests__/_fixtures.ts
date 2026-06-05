import type { Bike } from "@/src/domain/types";
import type { RiderProfileV1 } from "@/src/domain/rider-profile";

/** A complete, adult-sized trail bike. Override only what a test cares about. */
export function makeBike(overrides: Partial<Bike> = {}): Bike {
  return {
    id: 1,
    brand: "Giant",
    model: "Trance",
    year: 2024,
    category: "Trail",
    wheel: '29"',
    travel: "140mm",
    suspension: "Full",
    frame: "Alloy",
    drivetrain: "SRAM SX",
    fork: "RockShox",
    shock: "Fox",
    weight: "14kg",
    brakes: "SRAM",
    description: "A capable trail bike for mixed terrain",
    prices: { storeA: 3000 },
    inStock: ["storeA"],
    isEbike: false,
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<RiderProfileV1> = {}): RiderProfileV1 {
  return {
    version: 1,
    nickname: "Lee",
    heightCm: 178,
    weightKg: 78,
    style: "trail",
    preferEbike: false,
    ...overrides,
  };
}
