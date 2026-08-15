import { describe, expect, it } from "vitest";

import {
  CREDIT_PACKS,
  expectedCreditsForAmountMinor,
  findCreditPack,
} from "./credit-packs";

describe("CREDIT_PACKS", () => {
  // The invariant that matters: a hand-edited price must never sell credits at
  // the wrong rate. Selling 50,000 credits for $25 is a silent 50% discount.
  it("grants exactly the credits its price is worth", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.credits).toBe(
        expectedCreditsForAmountMinor(pack.amountMinor),
      );
    }
  });

  it("has unique ids, since Stripe metadata round-trips them", () => {
    const ids = CREDIT_PACKS.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prices every pack above zero", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.amountMinor).toBeGreaterThan(0);
      expect(Number.isInteger(pack.amountMinor)).toBe(true);
    }
  });
});

describe("findCreditPack", () => {
  it("finds a known pack", () => {
    expect(findCreditPack("pack-50")?.credits).toBe(50_000);
  });

  it("returns undefined for an unknown id rather than a default", () => {
    expect(findCreditPack("pack-free")).toBeUndefined();
  });
});
