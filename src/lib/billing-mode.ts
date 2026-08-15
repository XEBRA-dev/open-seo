import { z } from "zod";

const BILLING_PROVIDERS = ["xebra", "none"] as const;

type BillingProvider = (typeof BILLING_PROVIDERS)[number];

const billingProviderSchema = z.enum(BILLING_PROVIDERS);

const warnedInvalidProviders = new Set<string>();

/**
 * Which billing backend meters DataForSEO spend.
 *
 * Deliberately separate from AUTH_MODE. Upstream gates both authentication and
 * Autumn billing on `isHostedAuthMode`, but this deployment needs hosted-style
 * auth with XEBRA's own ledger instead of Autumn, so the two concerns cannot
 * share a switch.
 *
 * Defaults to "none" — no metering, matching current self-host behaviour. Fails
 * OPEN so a deployment that has not opted in keeps working exactly as before,
 * and a mistyped value does not silently start charging an unconfigured ledger.
 */
export function getBillingProvider(
  value: string | null | undefined,
): BillingProvider {
  const parsed = billingProviderSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  // Unset is a legitimate default; a SET-but-invalid value is an operator typo
  // they need to hear about, since it silently disables billing.
  if (value && !warnedInvalidProviders.has(value)) {
    warnedInvalidProviders.add(value);
    console.error(
      `Invalid BILLING_PROVIDER "${value}" — falling back to "none" (no metering). Valid values: ${BILLING_PROVIDERS.join(", ")}.`,
    );
  }

  return "none";
}

export function isXebraBillingProvider(
  value: string | null | undefined,
): boolean {
  return getBillingProvider(value) === "xebra";
}
