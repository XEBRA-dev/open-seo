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

/**
 * Stripe Tax product tax code.
 *
 * Required: verified against the live account, whose tax settings default is
 * `tax_code: null`, so with none set on the line item Stripe Tax has nothing to
 * classify the sale by.
 *
 * Defaults to SaaS (business use), the standard classification for cloud
 * software sold to companies. `txcd_10701400` ("Website Information Services -
 * business use") is arguably a closer description of an SEO data tool. Which is
 * correct is a decision for an accountant, not this code — hence the override.
 */
async function getTaxCode(): Promise<string> {
  return (await getOptionalEnvValue("STRIPE_TAX_CODE")) ?? "txcd_10103001";
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
  const [currency, taxCode] = await Promise.all([getCurrency(), getTaxCode()]);

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
          // Explicit rather than relying on the dashboard default, so the
          // charged amount does not silently change if that setting is edited.
          // Exclusive: VAT is added on top of the pack price, which is why the
          // UI labels packs as excluding VAT.
          tax_behavior: "exclusive",
          product_data: {
            name: `${pack.credits.toLocaleString("en-US")} SEO credits`,
            description: `Prepaid credits for ${pack.label} of DataForSEO usage.`,
            tax_code: taxCode,
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
    // Stripe Tax is active on the account (verified), head office SE.
    automatic_tax: { enabled: true },
    // Lets an EU business enter its VAT number so reverse charge applies
    // instead of Swedish MOMS. Without this, automatic_tax charges every EU
    // customer VAT with no way to declare a VAT ID — and the billing page
    // promises otherwise.
    tax_id_collection: { enabled: true },
  });

  if (!session.url) {
    throw new AppError(
      "UPSTREAM_UNAVAILABLE",
      "Stripe did not return a checkout URL.",
    );
  }

  return { url: session.url };
}
