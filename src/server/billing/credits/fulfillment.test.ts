import { describe, expect, it } from "vitest";

import { parseCheckoutFulfillment } from "./fulfillment";

const paidSession = {
  id: "cs_1",
  payment_status: "paid",
  payment_intent: "pi_123",
  metadata: {
    xebra_organization_id: "org-1",
    xebra_pack_id: "pack-50",
    xebra_credits: "50000",
  },
};

describe("parseCheckoutFulfillment", () => {
  it("accepts a paid session and resolves the grant", () => {
    const result = parseCheckoutFulfillment(paidSession);

    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: "org-1",
        packId: "pack-50",
        credits: 50_000,
        paymentIntentId: "pi_123",
      },
    });
  });

  // Nothing is granted until Stripe says the money arrived.
  it("refuses an unpaid session", () => {
    const result = parseCheckoutFulfillment({
      ...paidSession,
      payment_status: "unpaid",
    });

    expect(result.ok).toBe(false);
  });

  // Metadata is echoed back by Stripe, so it must not decide the payout.
  // A tampered credits value is refused rather than honoured.
  it("refuses when metadata credits disagree with the pack", () => {
    const result = parseCheckoutFulfillment({
      ...paidSession,
      metadata: { ...paidSession.metadata, xebra_credits: "5000000" },
    });

    expect(result).toEqual({
      ok: false,
      reason: "credits metadata (5000000) disagrees with pack pack-50 (50000)",
    });
  });

  it("takes the credit amount from the pack table, not from metadata", () => {
    const result = parseCheckoutFulfillment({
      ...paidSession,
      metadata: {
        xebra_organization_id: "org-1",
        xebra_pack_id: "pack-25",
        // absent, so nothing to cross-check against
      },
    });

    expect(result.ok && result.value.credits).toBe(25_000);
  });

  it("refuses an unknown pack", () => {
    const result = parseCheckoutFulfillment({
      ...paidSession,
      metadata: { ...paidSession.metadata, xebra_pack_id: "pack-free" },
    });

    expect(result.ok).toBe(false);
  });

  it("refuses a session with no organization", () => {
    const result = parseCheckoutFulfillment({
      ...paidSession,
      metadata: { xebra_pack_id: "pack-50" },
    });

    expect(result.ok).toBe(false);
  });

  it("reads an expanded payment intent object", () => {
    const result = parseCheckoutFulfillment({
      ...paidSession,
      payment_intent: { id: "pi_expanded" },
    });

    expect(result.ok && result.value.paymentIntentId).toBe("pi_expanded");
  });

  // Falling back to the session id keeps the idempotency key non-null; a NULL
  // would not be constrained by the partial unique index and could double-credit.
  it("falls back to the session id when no payment intent is present", () => {
    const result = parseCheckoutFulfillment({
      ...paidSession,
      payment_intent: null,
    });

    expect(result.ok && result.value.paymentIntentId).toBe("cs_1");
  });
});
