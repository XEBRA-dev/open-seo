import type { Stripe } from "stripe";

import { getRequiredEnvValue } from "@/server/lib/runtime-env";

let stripePromise: Promise<Stripe> | undefined;

/**
 * Lazily-constructed Stripe client, configured for the Workers runtime.
 *
 * Two Workers-specific requirements, both easy to get wrong:
 *
 * 1. `createFetchHttpClient()` — the SDK defaults to Node's `http` module,
 *    which does not exist here.
 * 2. Webhook signatures must be verified with `constructEventAsync` and a
 *    SubtleCrypto provider (see verifyStripeWebhook); the synchronous
 *    `constructEvent` uses Node crypto and throws on Workers.
 *
 * Kept lazy so deployments without Stripe never load the SDK at all.
 */
export function getStripe(): Promise<Stripe> {
  return (stripePromise ??= (async () => {
    const { default: StripeCtor } = await import("stripe");
    const secretKey = await getRequiredEnvValue("STRIPE_SECRET_KEY");

    return new StripeCtor(secretKey, {
      httpClient: StripeCtor.createFetchHttpClient(),
    });
  })());
}

/**
 * Verifies a webhook signature and returns the parsed event.
 *
 * Uses the async path deliberately — see above. A failed verification throws,
 * and callers must treat that as a 400: an unverified event is an attacker
 * claiming a payment succeeded.
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signature: string,
): Promise<Stripe.Event> {
  const { default: StripeCtor } = await import("stripe");
  const stripe = await getStripe();
  const webhookSecret = await getRequiredEnvValue("STRIPE_WEBHOOK_SECRET");

  return stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    webhookSecret,
    undefined,
    StripeCtor.createSubtleCryptoProvider(),
  );
}
