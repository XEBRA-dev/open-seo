import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization, user } from "./better-auth-schema";

/**
 * Per-organization billing policy for the XEBRA-operated deployment.
 *
 * Kept out of better-auth's `organization` table so its generated schema and
 * our columns never collide, and out of upstream's `billing.schema.ts` so an
 * upstream Autumn change cannot conflict with ours.
 */
export const orgBillingConfig = sqliteTable("org_billing_config", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // "metered": refuse new work at a zero balance.
  // "unlimited": record spend for cost reporting but never block. XEBRA's own
  // organizations run this way.
  mode: text("mode").notNull().default("metered"),
  // Markup over raw DataForSEO cost, in basis points. 12500 = 1.25x.
  // Integer, not a float: money-adjacent maths must not accumulate drift.
  // Independent of `mode` — a metered org at 10000 (billed at cost) and an
  // unlimited org at 12500 are both valid.
  markupBps: integer("markup_bps").notNull().default(12500),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Append-only credit ledger. Rows are never updated or deleted; a correction is
 * another row. Balance is derived as SUM(delta_credits), which makes a
 * balance/history disagreement structurally impossible.
 *
 * 1000 credits = 1 USD of customer-charged value, matching upstream's
 * AUTUMN_SEO_DATA_CREDITS_PER_USD so display code and mental models carry over.
 */
export const creditLedger = sqliteTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Positive adds credit, negative spends it.
    deltaCredits: integer("delta_credits").notNull(),
    // grant | purchase | spend | refund | adjustment
    kind: text("kind").notNull(),
    // Spend rows only: raw DataForSEO cost before markup, in micro-USD, so
    // internal cost reporting stays exact without floats.
    rawCostMicroUsd: integer("raw_cost_micro_usd"),
    markupBps: integer("markup_bps"),
    description: text("description"),
    // Purchase rows only. Unique when present so a replayed Stripe webhook
    // cannot double-credit an organization.
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    // Grant/adjustment rows: which admin did this.
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    // Every balance query and history listing filters by organization.
    index("credit_ledger_organization_id_idx").on(table.organizationId),
    uniqueIndex("credit_ledger_stripe_payment_intent_idx")
      .on(table.stripePaymentIntentId)
      .where(sql`${table.stripePaymentIntentId} IS NOT NULL`),
  ],
);
