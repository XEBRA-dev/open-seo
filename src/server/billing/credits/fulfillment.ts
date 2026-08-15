import { findCreditPack } from "@/shared/credit-packs";

import {
  STRIPE_METADATA_CREDITS,
  STRIPE_METADATA_ORG_ID,
  STRIPE_METADATA_PACK_ID,
} from "./checkout";

type CheckoutFulfillment = {
  organizationId: string;
  packId: string;
  credits: number;
  paymentIntentId: string;
};

type ParseResult =
  | { ok: true; value: CheckoutFulfillment }
  | { ok: false; reason: string };

type SessionLike = {
  payment_status?: string | null;
  payment_intent?: string | { id?: string } | null;
  id?: string | null;
  metadata?: Record<string, string> | null;
};

function readPaymentIntentId(session: SessionLike): string | null {
  const intent = session.payment_intent;
  if (typeof intent === "string" && intent) return intent;
  if (intent && typeof intent === "object" && typeof intent.id === "string") {
    return intent.id;
  }
  // One-off Checkout sessions normally carry a payment intent, but falling back
  // to the session id keeps the idempotency key present rather than writing a
  // NULL that the unique index would not constrain.
  return typeof session.id === "string" && session.id ? session.id : null;
}

/**
 * Validates a completed Checkout session into a credit grant.
 *
 * The credit amount is taken from OUR pack table keyed by the pack id, not from
 * the `credits` metadata value — metadata is echoed back by Stripe and should
 * be treated as untrusted for anything that decides how much to hand out. The
 * metadata credits are only cross-checked, so a mismatch is refused rather than
 * quietly honoured.
 */
export function parseCheckoutFulfillment(session: SessionLike): ParseResult {
  if (session.payment_status !== "paid") {
    return {
      ok: false,
      reason: `payment_status is "${session.payment_status}", not "paid"`,
    };
  }

  const metadata = session.metadata ?? {};
  const organizationId = metadata[STRIPE_METADATA_ORG_ID];
  const packId = metadata[STRIPE_METADATA_PACK_ID];

  if (!organizationId)
    return { ok: false, reason: "missing organization id in metadata" };
  if (!packId) return { ok: false, reason: "missing pack id in metadata" };

  const pack = findCreditPack(packId);
  if (!pack) return { ok: false, reason: `unknown pack "${packId}"` };

  const claimedCredits = Number(metadata[STRIPE_METADATA_CREDITS]);
  if (Number.isFinite(claimedCredits) && claimedCredits !== pack.credits) {
    return {
      ok: false,
      reason: `credits metadata (${claimedCredits}) disagrees with pack ${packId} (${pack.credits})`,
    };
  }

  const paymentIntentId = readPaymentIntentId(session);
  if (!paymentIntentId)
    return { ok: false, reason: "no payment intent or session id" };

  return {
    ok: true,
    value: {
      organizationId,
      packId,
      credits: pack.credits,
      paymentIntentId,
    },
  };
}
