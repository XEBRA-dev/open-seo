import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { creditLedger, orgBillingConfig } from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import {
  NO_MARKUP_BPS,
  creditsForRawCost,
  rawCostToMicroUsd,
} from "@/shared/credits";

type BillingMode = "metered" | "unlimited";

type OrgBillingPolicy = {
  mode: BillingMode;
  markupBps: number;
};

type CreditLedgerKind =
  | "grant"
  | "purchase"
  | "spend"
  | "refund"
  | "adjustment";

/**
 * Policy for an organization with no explicit config row.
 *
 * Deliberately fails OPEN: unlimited, at raw cost. An organization only becomes
 * metered when an operator configures it. Failing closed here would lock XEBRA
 * out of its own tool the moment this ships, since the existing workspace has
 * no config row and a zero balance. Customer organizations are given an
 * explicit metered policy when they are created.
 */
const DEFAULT_POLICY: OrgBillingPolicy = {
  mode: "unlimited",
  markupBps: NO_MARKUP_BPS,
};

function toBillingMode(value: string): BillingMode {
  return value === "metered" ? "metered" : "unlimited";
}

export async function getOrgBillingPolicy(
  organizationId: string,
): Promise<OrgBillingPolicy> {
  const row = await db.query.orgBillingConfig.findFirst({
    columns: { mode: true, markupBps: true },
    where: eq(orgBillingConfig.organizationId, organizationId),
  });

  if (!row) return DEFAULT_POLICY;

  return { mode: toBillingMode(row.mode), markupBps: row.markupBps };
}

export async function setOrgBillingPolicy(input: {
  organizationId: string;
  mode: BillingMode;
  markupBps: number;
}): Promise<void> {
  await db
    .insert(orgBillingConfig)
    .values({
      organizationId: input.organizationId,
      mode: input.mode,
      markupBps: input.markupBps,
    })
    .onConflictDoUpdate({
      target: orgBillingConfig.organizationId,
      set: {
        mode: input.mode,
        markupBps: input.markupBps,
        updatedAt: sql`(current_timestamp)`,
      },
    });
}

/**
 * Current balance, derived from the ledger rather than stored.
 *
 * Deriving makes a balance/history disagreement structurally impossible. The
 * indexed SUM is cheap at agency scale; revisit only if a single organization
 * exceeds ~100k ledger rows, at which point the fix is a materialized balance
 * updated in the same statement as the insert.
 */
export async function getCreditBalance(
  organizationId: string,
): Promise<number> {
  const [row] = await db
    .select({
      balance: sql<number>`coalesce(sum(${creditLedger.deltaCredits}), 0)`,
    })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId));

  return Number(row?.balance ?? 0);
}

/**
 * Refuses new work when a metered organization is out of credit.
 *
 * Advisory by design: this is a read, so two concurrent requests can both pass
 * it. See {@link recordSpend} for why that is the correct trade-off.
 */
export async function assertCreditsAvailable(
  organizationId: string,
): Promise<void> {
  const policy = await getOrgBillingPolicy(organizationId);
  if (policy.mode !== "metered") return;

  const balance = await getCreditBalance(organizationId);
  if (balance > 0) return;

  throw new AppError(
    "INSUFFICIENT_CREDITS",
    "This workspace is out of credits. Top up to continue running analyses.",
  );
}

/**
 * Records a DataForSEO spend. Always writes, even when it drives the balance
 * negative.
 *
 * The cost is unknown until DataForSEO has already charged us, so refusing to
 * record it here would lose the only accurate record of XEBRA's true cost while
 * the money is gone regardless. An organization can therefore go slightly
 * negative, bounded by the calls already in flight; the next
 * {@link assertCreditsAvailable} blocks them. That bounded, prepaid-
 * collateralised overdraft is preferred over unmetered spend.
 */
export async function recordSpend(input: {
  organizationId: string;
  rawCostUsd: number;
  markupBps: number;
  description?: string;
}): Promise<number> {
  const credits = creditsForRawCost(input.rawCostUsd, input.markupBps);
  if (credits <= 0) return 0;

  await db.insert(creditLedger).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    deltaCredits: -credits,
    kind: "spend",
    rawCostMicroUsd: rawCostToMicroUsd(input.rawCostUsd),
    markupBps: input.markupBps,
    description: input.description ?? null,
  });

  return credits;
}

/**
 * Adds credit. Used by both the admin grant path and the Stripe webhook.
 *
 * `stripePaymentIntentId` is covered by a unique index, so a replayed webhook
 * raises a constraint error rather than double-crediting. Callers that may
 * legitimately retry should treat that as success.
 */
export async function addCredits(input: {
  organizationId: string;
  credits: number;
  kind: Extract<
    CreditLedgerKind,
    "grant" | "purchase" | "refund" | "adjustment"
  >;
  description?: string;
  actorUserId?: string | null;
  stripePaymentIntentId?: string | null;
}): Promise<void> {
  if (!Number.isInteger(input.credits) || input.credits === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Credit amount must be a non-zero integer.",
    );
  }

  await db.insert(creditLedger).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    deltaCredits: input.credits,
    kind: input.kind,
    description: input.description ?? null,
    actorUserId: input.actorUserId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
  });
}

/**
 * Whether a purchase for this payment intent has already been recorded.
 *
 * The unique index is the real guard against a replayed webhook; this exists so
 * the webhook can tell "already fulfilled" (a success — Stripe retries on any
 * non-2xx) apart from a genuine write failure.
 */
export async function hasPurchaseForPaymentIntent(
  paymentIntentId: string,
): Promise<boolean> {
  const row = await db.query.creditLedger.findFirst({
    columns: { id: true },
    where: eq(creditLedger.stripePaymentIntentId, paymentIntentId),
  });

  return Boolean(row);
}

type CreditLedgerEntry = {
  id: string;
  deltaCredits: number;
  kind: string;
  description: string | null;
  rawCostMicroUsd: number | null;
  markupBps: number | null;
  createdAt: string;
};

export async function listCreditLedger(
  organizationId: string,
  limit = 100,
): Promise<CreditLedgerEntry[]> {
  return db
    .select({
      id: creditLedger.id,
      deltaCredits: creditLedger.deltaCredits,
      kind: creditLedger.kind,
      description: creditLedger.description,
      rawCostMicroUsd: creditLedger.rawCostMicroUsd,
      markupBps: creditLedger.markupBps,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
}
