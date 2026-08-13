import { z } from "zod";

import { normalizeDomain } from "@/shared/normalizeDomain";

export const BACKLINK_GAP_MAX_COMPETITORS = 4;

/**
 * Server-function input.
 *
 * `projectId` MUST be here: ensureUserMiddleware reads it off the request
 * payload to attach the project to the request context, and
 * requireProjectContext throws INTERNAL_ERROR when it is missing.
 */
export const backlinkGapInputSchema = z.object({
  projectId: z.string().min(1),
  clientDomain: z.string().min(1).max(255),
  // At least one competitor: a gap needs something to compare against.
  competitorDomains: z
    .array(z.string().min(1).max(255))
    .min(1)
    .max(BACKLINK_GAP_MAX_COMPETITORS),
  hideSpam: z.boolean().optional(),
});

/** URL search params for the page. */
export const backlinkGapSearchSchema = z.object({
  client: z.string().optional(),
  competitors: z.string().optional(),
  gapOnly: z.boolean().optional(),
  withSpam: z.boolean().optional(),
});

/** Split the comma-separated `competitors` param into deduped bare domains. */
export function parseBacklinkCompetitors(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const domain = normalizeDomain(part);
    if (domain) seen.add(domain);
  }
  return [...seen].slice(0, BACKLINK_GAP_MAX_COMPETITORS);
}
