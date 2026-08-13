import { z } from "zod";

export const BUSINESS_PROFILE_MAX_BUSINESSES = 5;

/** `projectId` is required so ensureUserMiddleware can attach the project. */
export const businessProfileInputSchema = z.object({
  projectId: z.string().min(1),
  queries: z
    .array(z.string().min(1).max(255))
    .min(1)
    .max(BUSINESS_PROFILE_MAX_BUSINESSES),
  locationName: z.string().max(255).optional(),
  languageCode: z.string().max(10).optional(),
});

export const businessProfileSearchSchema = z.object({
  q: z.string().optional(),
  loc: z.string().optional(),
});

/** Split the comma-separated `q` param into deduped business names. */
export function parseBusinessQueries(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const query = part.trim();
    if (query) seen.add(query);
  }
  return [...seen].slice(0, BUSINESS_PROFILE_MAX_BUSINESSES);
}
