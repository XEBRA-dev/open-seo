import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  addCredits,
  getCreditBalance,
  getOrgBillingPolicy,
  listCreditLedger,
  setOrgBillingPolicy,
} from "@/server/billing/credits/creditLedger";
import {
  assertOperator,
  isOperatorEmail,
} from "@/server/billing/credits/operator";
import { createCreditCheckoutSession } from "@/server/billing/credits/checkout";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

/** Balance, policy and recent history for the caller's own organization. */
export const getCreditSummary = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    const { organizationId } = context;
    const [balance, policy, entries] = await Promise.all([
      getCreditBalance(organizationId),
      getOrgBillingPolicy(organizationId),
      listCreditLedger(organizationId, 50),
    ]);

    return {
      balance,
      policy,
      entries,
      isOperator: isOperatorEmail(context.userEmail),
    };
  });

const checkoutInputSchema = z.object({
  packId: z.string().min(1),
  origin: z.string().url(),
});

/**
 * Starts a Stripe Checkout session for a credit pack.
 *
 * The organization comes from the authenticated context, never from the
 * request — otherwise a caller could top up somebody else's balance, or
 * credit their own from another org's payment.
 */
export const startCreditCheckout = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(checkoutInputSchema)
  .handler(async ({ data, context }) =>
    createCreditCheckoutSession({
      organizationId: context.organizationId,
      packId: data.packId,
      customerEmail: context.userEmail,
      origin: data.origin,
    }),
  );

const grantInputSchema = z.object({
  organizationId: z.string().min(1),
  credits: z.number().int(),
  description: z.string().max(200).optional(),
});

/**
 * Operator-only: wire credits into an organization by hand.
 *
 * This is how XEBRA tops customers up outside Stripe (invoiced clients, goodwill
 * credit, opening balances) and how its own workspaces are funded. Every grant
 * is a ledger row stamped with the acting user, so it is auditable.
 */
export const grantCredits = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(grantInputSchema)
  .handler(async ({ data, context }) => {
    await assertOperator(context.userEmail);

    await addCredits({
      organizationId: data.organizationId,
      credits: data.credits,
      kind: "grant",
      description: data.description ?? "Manual grant",
      actorUserId: context.userId,
    });

    return { balance: await getCreditBalance(data.organizationId) };
  });

const policyInputSchema = z.object({
  organizationId: z.string().min(1),
  mode: z.enum(["metered", "unlimited"]),
  markupBps: z.number().int().min(10_000).max(100_000),
});

/**
 * Operator-only: set an organization's billing policy.
 *
 * markupBps is floored at 10000 (1.00x) so a mistyped value can never sell
 * DataForSEO usage below cost.
 */
export const setBillingPolicy = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(policyInputSchema)
  .handler(async ({ data, context }) => {
    await assertOperator(context.userEmail);

    await setOrgBillingPolicy({
      organizationId: data.organizationId,
      mode: data.mode,
      markupBps: data.markupBps,
    });

    return { ok: true };
  });
