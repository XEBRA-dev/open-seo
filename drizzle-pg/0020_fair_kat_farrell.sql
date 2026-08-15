CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"delta_credits" integer NOT NULL,
	"kind" text NOT NULL,
	"raw_cost_micro_usd" integer,
	"markup_bps" integer,
	"description" text,
	"stripe_payment_intent_id" text,
	"actor_user_id" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_billing_config" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'metered' NOT NULL,
	"markup_bps" integer DEFAULT 12500 NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_billing_config" ADD CONSTRAINT "org_billing_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_organization_id_idx" ON "credit_ledger" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_stripe_payment_intent_idx" ON "credit_ledger" USING btree ("stripe_payment_intent_id") WHERE "credit_ledger"."stripe_payment_intent_id" IS NOT NULL;