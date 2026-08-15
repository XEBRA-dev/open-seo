import { describe, expect, it } from "vitest";

import { getBillingProvider, isXebraBillingProvider } from "./billing-mode";

describe("getBillingProvider", () => {
  it("reads a valid provider", () => {
    expect(getBillingProvider("xebra")).toBe("xebra");
    expect(getBillingProvider("none")).toBe("none");
  });

  // Fails open: an unconfigured deployment must behave exactly as it did
  // before billing existed, rather than charging an empty ledger.
  it("defaults to none when unset", () => {
    expect(getBillingProvider(undefined)).toBe("none");
    expect(getBillingProvider(null)).toBe("none");
    expect(getBillingProvider("")).toBe("none");
  });

  it("falls back to none on an invalid value rather than guessing", () => {
    expect(getBillingProvider("stripe")).toBe("none");
  });
});

describe("isXebraBillingProvider", () => {
  it("is true only for the xebra provider", () => {
    expect(isXebraBillingProvider("xebra")).toBe(true);
    expect(isXebraBillingProvider("none")).toBe(false);
    expect(isXebraBillingProvider(undefined)).toBe(false);
  });
});
