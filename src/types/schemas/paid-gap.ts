import { z } from "zod";

export const PAID_GAP_MAX_COMPETITORS = 4;

/** Server-function input. `projectId` comes from the route context. */
export const paidGapInputSchema = z.object({
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

/** Split the comma-separated `competitors` param into a deduped domain list. */
export function parseCompetitorDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const domain = part.trim();
    if (domain) seen.add(domain);
  }
  return [...seen].slice(0, PAID_GAP_MAX_COMPETITORS);
}
