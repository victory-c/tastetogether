import { describe, expect, it } from "vitest";

import { OCCASIONS } from "./occasions";

const g = (s: string) => `urn:tag:genre:place:restaurant${s ? `:${s}` : ""}`;

describe("occasion genre filters", () => {
  it("keeps real meals for date night", () => {
    for (const ok of ["", "steakhouse", "french", "sushi_bar", "modern_indian", "pizza"]) {
      expect(OCCASIONS.date.allow(g(ok))).toBe(true);
    }
  });

  it("drops cafés, dessert shops and bars from meal occasions", () => {
    for (const no of ["cafe", "cupcake_shop", "tea_house", "ice_cream_shop", "cocktail_bar", "bar", "coffee_shop"]) {
      expect(OCCASIONS.date.allow(g(no))).toBe(false);
    }
    expect(OCCASIONS.date.allow("urn:tag:genre:place:live_music_venue")).toBe(false);
  });

  it("coffee occasion only keeps cafés and sweets", () => {
    expect(OCCASIONS.coffee.allow(g("cafe"))).toBe(true);
    expect(OCCASIONS.coffee.allow(g("tea_house"))).toBe(true);
    expect(OCCASIONS.coffee.allow(g("steakhouse"))).toBe(false);
  });
});
