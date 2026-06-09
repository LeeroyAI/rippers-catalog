import { describe, expect, it } from "vitest";

import type { Bike } from "@/src/domain/types";
import { archetypeForTrails, bikesForTrails } from "../trail-bike-fit";

function bike(over: Partial<Bike>): Bike {
  return {
    id: 1, brand: "B", model: "M", year: 2026, category: "Trail", wheel: '29"', travel: "140mm",
    suspension: "", frame: "", drivetrain: "", fork: "", shock: "", weight: "", brakes: "",
    description: "", prices: { r: 5000 }, inStock: ["r"], isEbike: false, ...over,
  };
}

describe("archetypeForTrails", () => {
  it("defaults to trail when nothing is graded", () => {
    expect(archetypeForTrails([{ difficulty: null }, {}]).archetype).toBe("trail");
    expect(archetypeForTrails([]).gradedCount).toBe(0);
  });
  it("mellow grades -> xc, mid -> trail, steep -> enduro, gnarly -> gravity", () => {
    expect(archetypeForTrails([{ difficulty: 0 }, { difficulty: 1 }]).archetype).toBe("xc");
    expect(archetypeForTrails([{ difficulty: 2 }, { difficulty: 2 }]).archetype).toBe("trail");
    expect(archetypeForTrails([{ difficulty: 4 }, { difficulty: 3 }]).archetype).toBe("enduro");
    expect(archetypeForTrails([{ difficulty: 5 }, { difficulty: 6 }]).archetype).toBe("gravity");
  });
});

describe("bikesForTrails", () => {
  const catalog = [
    bike({ id: 1, category: "XC / Cross-Country", travel: "100mm" }),
    bike({ id: 2, category: "Trail", travel: "140mm" }),
    bike({ id: 3, category: "Enduro", travel: "170mm" }),
    bike({ id: 4, category: "eBike", travel: "150mm", isEbike: true, prices: { r: 11000 }, inStock: ["r"] }),
  ];

  it("ranks the longest-travel bike top for gnarly terrain (XC excluded)", () => {
    const fit = bikesForTrails([{ difficulty: 5 }, { difficulty: 6 }], catalog, { limit: 4 });
    expect(fit.archetype).toBe("gravity");
    expect(fit.bikes[0]!.bike.id).toBe(3); // the 170mm enduro bike tops
    expect(fit.bikes.map((b) => b.bike.id)).not.toContain(1); // 100mm XC bike doesn't belong
  });

  it("ranks XC top for mellow terrain", () => {
    const fit = bikesForTrails([{ difficulty: 0 }, { difficulty: 1 }], catalog);
    expect(fit.archetype).toBe("xc");
    expect(fit.bikes[0]!.bike.id).toBe(1);
  });

  it("respects budget and e-bike preference", () => {
    const fit = bikesForTrails([{ difficulty: 2 }], catalog, { budgetMax: 6000, preferEbike: false });
    const eb = fit.bikes.find((b) => b.bike.id === 4);
    // the $11k e-bike is pushed down by budget; a $5k acoustic trail bike leads
    expect(fit.bikes[0]!.bike.id).toBe(2);
    expect(eb === undefined || eb.score < fit.bikes[0]!.score).toBe(true);
  });
});
