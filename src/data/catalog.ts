import type { Bike } from "@/src/domain/types";

import catalogJson from "./catalog.json";

type JsonBike = {
  id: number;
  brand: string;
  model: string;
  year: number;
  category: string;
  wheel: string;
  travel: string;
  suspension: string;
  frame: string;
  drivetrain: string;
  fork: string;
  shock: string;
  weight: string;
  brakes: string;
  description: string;
  prices: Record<string, number>;
  inStock: string[];
  wasPrice?: number | null;
  isEbike: boolean;
  sizes?: string[];
  sourceUrl?: string | null;
  motor?: string | null;
  motorBrand?: string | null;
  battery?: string | null;
  range?: string | null;
  ageRange?: string | null;
};

const parsed: Bike[] = (catalogJson as unknown as JsonBike[]).map((j) => ({
  id: j.id,
  brand: j.brand,
  model: j.model,
  year: j.year,
  category: j.category,
  wheel: j.wheel,
  travel: j.travel,
  suspension: j.suspension,
  frame: j.frame,
  drivetrain: j.drivetrain,
  fork: j.fork,
  shock: j.shock,
  weight: j.weight,
  brakes: j.brakes,
  description: j.description,
  prices: j.prices,
  inStock: j.inStock,
  isEbike: j.isEbike,
  wasPrice: j.wasPrice ?? null,
  sizes: j.sizes,
  sourceUrl: j.sourceUrl ?? null,
  motor: j.motor ?? null,
  motorBrand: j.motorBrand ?? null,
  battery: j.battery ?? null,
  range: j.range ?? null,
  ageRange: j.ageRange ?? null,
}));

if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  parsed.length < 20
) {
  console.warn(
    `[rippers catalogue] Only ${parsed.length} bikes loaded — sync the full export from the monorepo root. From rippers-app run: npm run sync-catalog`
  );
}

export const catalog: Bike[] = parsed;
