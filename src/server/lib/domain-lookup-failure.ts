/**
 * Formats a per-domain lookup rejection for the server log.
 *
 * The gap-analysis services degrade rather than fail: a domain whose lookup
 * rejects is pushed onto `failedDomains` and the remaining domains are still
 * returned. That rejection therefore never reaches an error boundary, and the
 * user sees only "Could not fetch <domain>" — under which an expired API key,
 * a rate limit and a genuinely unknown domain are indistinguishable. Logging
 * the reason is the only way to tell them apart in production.
 */
export function describeDomainLookupFailure(
  feature: string,
  domain: string,
  reason: unknown,
): string {
  const detail =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason);

  return `[${feature}] domain lookup failed for ${domain} — ${detail}`;
}
