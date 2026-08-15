import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./better-auth-schema";

// See src/db/pg/app.schema.ts for why timestamps are ISO-8601 UTC text.
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Postgres mirror of src/db/credits.schema.ts — see there for the rationale. */
export const orgBillingConfig = pgTable("org_billing_config", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("metered"),
  markupBps: integer("markup_bps").notNull().default(12500),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
});

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    deltaCredits: integer("delta_credits").notNull(),
    kind: text("kind").notNull(),
    rawCostMicroUsd: integer("raw_cost_micro_usd"),
    markupBps: integer("markup_bps"),
    description: text("description"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    index("credit_ledger_organization_id_idx").on(table.organizationId),
    uniqueIndex("credit_ledger_stripe_payment_intent_idx")
      .on(table.stripePaymentIntentId)
      .where(sql`${table.stripePaymentIntentId} IS NOT NULL`),
  ],
);
