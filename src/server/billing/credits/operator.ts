import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

const DEFAULT_OPERATOR_DOMAIN = "xebra.dev";

/**
 * Whether an email belongs to a platform operator.
 *
 * Domain-based rather than a role column: it mirrors the Cloudflare Access
 * policy that already fronts this deployment, so there is one place to reason
 * about who is staff. Customers authenticate with their own domains and can
 * never match.
 *
 * Comparison is case-insensitive and anchored to the full suffix, so
 * `evil-xebra.dev` and `xebra.dev.attacker.com` are both rejected.
 */
export function isOperatorEmail(
  email: string | null | undefined,
  operatorDomain: string = DEFAULT_OPERATOR_DOMAIN,
): boolean {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  const domain = operatorDomain.trim().toLowerCase();
  if (!domain) return false;

  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;

  return normalized.slice(at + 1) === domain;
}

export async function assertOperator(
  email: string | null | undefined,
): Promise<void> {
  const domain =
    (await getOptionalEnvValue("OPERATOR_EMAIL_DOMAIN")) ??
    DEFAULT_OPERATOR_DOMAIN;

  if (isOperatorEmail(email, domain)) return;

  throw new AppError("FORBIDDEN", "Operator access required.");
}
