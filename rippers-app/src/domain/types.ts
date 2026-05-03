export type BikeSortOption = "bestMatch" | "priceLow" | "priceHigh" | "newest";

export type FilterState = {
  query: string;
  category: string | null;
  budgetMax: number | null;
  sort: BikeSortOption;
};

export type Bike = {
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
  isEbike: boolean;
  wasPrice?: number | null;
  sizes?: string[];
  sourceUrl?: string | null;
  motor?: string | null;
  motorBrand?: string | null;
  battery?: string | null;
  range?: string | null;
  ageRange?: string | null;
};

export const defaultFilters: FilterState = {
  query: "",
  category: null,
  budgetMax: null,
  sort: "bestMatch",
};
