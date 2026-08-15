import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook. Grants credits when a Checkout session is paid.
 *
 * Response codes matter here: Stripe retries on any non-2xx, so anything we do
 * not want retried (an already-fulfilled event, an event we deliberately
 * ignore) must return 200. Only a genuine, retryable failure returns 5xx.
 */
async function handleStripeWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  // Must be the raw body: any reserialization breaks the signature.
  const rawBody = await request.text();

  const { verifyStripeWebhook } =
    await import("@/server/billing/credits/stripeClient");

  let event;
  try {
    event = await verifyStripeWebhook(rawBody, signature);
  } catch (error) {
    // An unverified event is someone claiming a payment succeeded. 400, and
    // never retried.
    console.error("stripe.webhook.signature-verification-failed", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledged, not retried: we simply do not act on this event type.
    return Response.json({ received: true, ignored: event.type });
  }

  const { parseCheckoutFulfillment } =
    await import("@/server/billing/credits/fulfillment");
  const parsed = parseCheckoutFulfillment(
    event.data.object as Parameters<typeof parseCheckoutFulfillment>[0],
  );

  if (!parsed.ok) {
    // Not retryable — the same event would fail identically. Log loudly and
    // acknowledge, so it does not wedge Stripe's retry queue.
    console.error("stripe.webhook.unfulfillable", {
      eventId: event.id,
      reason: parsed.reason,
    });
    return Response.json({ received: true, skipped: parsed.reason });
  }

  const { addCredits, hasPurchaseForPaymentIntent } =
    await import("@/server/billing/credits/creditLedger");
  const { organizationId, credits, packId, paymentIntentId } = parsed.value;

  try {
    await addCredits({
      organizationId,
      credits,
      kind: "purchase",
      description: `Stripe purchase (${packId})`,
      stripePaymentIntentId: paymentIntentId,
    });
  } catch (error) {
    // The unique index on stripe_payment_intent_id is what makes a replayed
    // webhook safe. If the row is there now, this was a replay — success.
    if (await hasPurchaseForPaymentIntent(paymentIntentId)) {
      return Response.json({ received: true, duplicate: true });
    }

    console.error("stripe.webhook.credit-grant-failed", {
      eventId: event.id,
      organizationId,
      error,
    });
    // Genuine failure: 500 so Stripe retries and the customer is not left
    // having paid for credits they never received.
    return Response.json(
      { error: "Failed to record credits" },
      { status: 500 },
    );
  }

  return Response.json({ received: true, credits });
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleStripeWebhook(request),
    },
  },
});
