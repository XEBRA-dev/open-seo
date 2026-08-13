import { z } from "zod";

import { normalizeDomain } from "@/shared/normalizeDomain";

export const TECH_STACK_MAX_DOMAINS = 5;

/**
 * Server-function input.
 *
 * `projectId` MUST be here: ensureUserMiddleware reads it off the request
 * payload to attach the project to the request context.
 */
export const techStackInputSchema = z.object({
  projectId: z.string().min(1),
  domains: z
    .array(z.string().min(1).max(255))
    .min(1)
    .max(TECH_STACK_MAX_DOMAINS),
});

export const techStackSearchSchema = z.object({
  domains: z.string().optional(),
});

/** Split the comma-separated `domains` param into deduped bare domains. */
export function parseTechStackDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const domain = normalizeDomain(part);
    if (domain) seen.add(domain);
  }
  return [...seen].slice(0, TECH_STACK_MAX_DOMAINS);
}
