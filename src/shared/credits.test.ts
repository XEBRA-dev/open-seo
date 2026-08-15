import { describe, expect, it } from "vitest";

import {
  CREDITS_PER_USD,
  NO_MARKUP_BPS,
  XEBRA_MARKUP_BPS,
  creditsForRawCost,
  creditsToUsd,
  rawCostToMicroUsd,
  usdToCredits,
} from "./credits";

describe("creditsForRawCost", () => {
  // A domain_technologies call costs $0.012. At 1.25x that is $0.015, and
  // 1000 credits = $1, so 15 credits.
  it("applies the markup and converts to credits", () => {
    expect(creditsForRawCost(0.012, XEBRA_MARKUP_BPS)).toBe(15);
  });

  it("charges raw cost at 10000 bps, which is what XEBRA's own orgs use", () => {
    expect(creditsForRawCost(0.012, NO_MARKUP_BPS)).toBe(12);
  });

  // Rounding is always up, in XEBRA's favour. A call must never be free: at
  // sub-cent costs, rounding down would let a caller spend nothing.
  it("rounds up so a billed call always costs at least one credit", () => {
    expect(creditsForRawCost(0.0000001, XEBRA_MARKUP_BPS)).toBe(1);
    expect(creditsForRawCost(0.0101, NO_MARKUP_BPS)).toBe(11);
  });

  it("treats zero, negative and non-finite cost as free", () => {
    expect(creditsForRawCost(0, XEBRA_MARKUP_BPS)).toBe(0);
    expect(creditsForRawCost(-1, XEBRA_MARKUP_BPS)).toBe(0);
    expect(creditsForRawCost(Number.NaN, XEBRA_MARKUP_BPS)).toBe(0);
  });
});

describe("credit/USD conversion", () => {
  it("round-trips whole cents", () => {
    expect(usdToCredits(1)).toBe(CREDITS_PER_USD);
    expect(creditsToUsd(CREDITS_PER_USD)).toBe(1);
  });

  // Purchases must never credit more than was paid for.
  it("floors when buying so a fractional cent cannot be rounded into credit", () => {
    expect(usdToCredits(0.0009)).toBe(0);
    expect(usdToCredits(1.9999)).toBe(1999);
  });
});

describe("rawCostToMicroUsd", () => {
  it("stores raw cost as an exact integer", () => {
    expect(rawCostToMicroUsd(0.012)).toBe(12000);
    expect(rawCostToMicroUsd(0)).toBe(0);
  });

  it("rounds rather than truncating sub-micro noise from float maths", () => {
    expect(rawCostToMicroUsd(0.0000005)).toBe(1);
  });
});
