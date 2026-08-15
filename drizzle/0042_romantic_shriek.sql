CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`delta_credits` integer NOT NULL,
	`kind` text NOT NULL,
	`raw_cost_micro_usd` integer,
	`markup_bps` integer,
	`description` text,
	`stripe_payment_intent_id` text,
	`actor_user_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `credit_ledger_organization_id_idx` ON `credit_ledger` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_ledger_stripe_payment_intent_idx` ON `credit_ledger` (`stripe_payment_intent_id`) WHERE "credit_ledger"."stripe_payment_intent_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `org_billing_config` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'metered' NOT NULL,
	`markup_bps` integer DEFAULT 12500 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
