import { describe, expect, it } from "vitest";

import { gearForRide } from "../gear-fit";
import type { Bike } from "@/src/domain/types";

function bike(over: Partial<Bike>): Bike {
  return {
    id: 1, brand: "B", model: "M", year: 2026, category: "Trail", wheel: '29"', travel: "140mm",
    suspension: "", frame: "", drivetrain: "SRAM GX Eagle", fork: "Fox 36", shock: "Fox Float X",
    weight: "", brakes: "Shimano XT", description: "", prices: { r: 5000 }, inStock: ["r"], isEbike: false, ...over,
  };
}

const descs = (items: { desc: string; name: string }[]) => items.map((i) => `${i.name} ${i.desc}`).join(" | ");

describe("gearForRide", () => {
  it("keys tools off the bike's actual component brands (not hardcoded Fox)", () => {
    const g = gearForRide(bike({ drivetrain: "Shimano XT", brakes: "SRAM Code", fork: "RockShox Lyrik", shock: "RockShox Super Deluxe" }));
    const tools = descs(g.tools);
    expect(tools).toContain("Shimano"); // drivetrain
    expect(tools).toContain("SRAM"); // brakes
    expect(tools).toContain("RockShox"); // suspension
    expect(tools.toLowerCase()).toContain("dot"); // SRAM brakes -> DOT fluid
  });

  it("adds e-bike essentials only for e-bikes", () => {
    const eb = gearForRide(bike({ isEbike: true, category: "eBike" }));
    expect(descs(eb.tools).toLowerCase()).toContain("e-bike");
    const ac = gearForRide(bike({ isEbike: false }));
    expect(descs(ac.tools).toLowerCase()).not.toContain("e-bike essentials");
  });

  it("scales protection with discipline", () => {
    const dh = gearForRide(bike({ category: "Enduro", travel: "180mm" }));
    expect(descs(dh.protection).toLowerCase()).toContain("back protector");
    const xc = gearForRide(bike({ category: "XC / Cross-Country", travel: "100mm" }));
    expect(descs(xc.protection).toLowerCase()).not.toContain("back protector");
  });

  it("reflects wheel size in the tubeless/tube pick", () => {
    const g = gearForRide(bike({ wheel: '27.5"' }));
    expect(descs(g.tools)).toContain("27.5");
  });

  it("falls back to style when there's no catalogue bike (custom ride)", () => {
    const g = gearForRide(null, { style: "gravity", isEbike: false });
    expect(g.protection.length).toBeGreaterThan(0);
    expect(g.tools.length).toBeGreaterThan(0);
  });

  it("recommends mineral oil for Shimano brakes", () => {
    const g = gearForRide(bike({ brakes: "Shimano XT" }));
    expect(descs(g.tools).toLowerCase()).toContain("mineral oil");
  });
});
