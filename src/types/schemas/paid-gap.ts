import { z } from "zod";

import { normalizeDomain } from "@/shared/normalizeDomain";

export const PAID_GAP_MAX_COMPETITORS = 4;

/**
 * Server-function input.
 *
 * `projectId` MUST be here: ensureUserMiddleware reads it off the request
 * payload to attach the project to the request context, and
 * requireProjectContext throws INTERNAL_ERROR when it is missing.
 */
export const paidGapInputSchema = z.object({
  projectId: z.string().min(1),
  clientDomain: z.string().min(1).max(255),
  competitorDomains: z
    .array(z.string().min(1).max(255))
    .max(PAID_GAP_MAX_COMPETITORS),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(10),
});

/** URL search params for the page. */
export const paidGapSearchSchema = z.object({
  client: z.string().optional(),
  competitors: z.string().optional(),
  gapOnly: z.boolean().optional(),
});

/**
 * Split the comma-separated `competitors` param into a deduped list of bare
 * domains. Normalizing here means a pasted URL and a bare domain collapse to
 * the same entry, which also keeps the dedupe honest.
 */
export function parseCompetitorDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const domain = normalizeDomain(part);
    if (domain) seen.add(domain);
  }
  return [...seen].slice(0, PAID_GAP_MAX_COMPETITORS);
}
