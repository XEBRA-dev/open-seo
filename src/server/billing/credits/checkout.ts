import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { findCreditPack } from "@/shared/credit-packs";

import { getStripe } from "./stripeClient";

/**
 * Metadata keys round-tripped through Stripe and read back by the webhook.
 * The organization id must come from the session we created, never from
 * anything the browser can influence.
 */
export const STRIPE_METADATA_ORG_ID = "xebra_organization_id";
export const STRIPE_METADATA_PACK_ID = "xebra_pack_id";
export const STRIPE_METADATA_CREDITS = "xebra_credits";

/** Credits are USD-denominated; a non-USD currency introduces FX drift against
 *  DataForSEO's USD billing, so USD is the default and the override is
 *  deliberate. */
async function getCurrency(): Promise<string> {
  return (await getOptionalEnvValue("STRIPE_CURRENCY")) ?? "usd";
}

export async function createCreditCheckoutSession(input: {
  organizationId: string;
  packId: string;
  customerEmail?: string;
  origin: string;
}): Promise<{ url: string }> {
  const pack = findCreditPack(input.packId);
  if (!pack) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Unknown credit pack "${input.packId}".`,
    );
  }

  const stripe = await getStripe();
  const currency = await getCurrency();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Prices are defined in code rather than as Stripe Price objects so a
    // deployment needs only API keys — no dashboard product setup.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: pack.amountMinor,
          product_data: {
            name: `${pack.credits.toLocaleString("en-US")} SEO credits`,
            description: `Prepaid credits for ${pack.label} of DataForSEO usage.`,
          },
        },
      },
    ],
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    success_url: `${input.origin}/billing?purchase=success`,
    cancel_url: `${input.origin}/billing?purchase=cancelled`,
    metadata: {
      [STRIPE_METADATA_ORG_ID]: input.organizationId,
      [STRIPE_METADATA_PACK_ID]: pack.id,
      [STRIPE_METADATA_CREDITS]: String(pack.credits),
    },
    // Swedish B2B: Stripe Tax handles MOMS and EU reverse charge once enabled
    // on the account. Harmless when it is not.
    automatic_tax: { enabled: true },
  });

  if (!session.url) {
    throw new AppError(
      "UPSTREAM_UNAVAILABLE",
      "Stripe did not return a checkout URL.",
    );
  }

  return { url: session.url };
}
