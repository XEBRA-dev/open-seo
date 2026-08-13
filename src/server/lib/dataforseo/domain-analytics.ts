import { DomainAnalyticsTechnologiesDomainTechnologiesLiveRequestInfo } from "dataforseo-client";
import { z } from "zod";

import { domainAnalyticsApi } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  parseTaskItems,
  type DataforseoApiResponse,
} from "@/server/lib/dataforseo/envelope";

// `technologies` is a free-form map of group -> category -> string[], so it is
// kept loose rather than enumerating a vendor taxonomy that changes over time.
const domainTechnologiesItemSchema = z
  .object({
    domain: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    domain_rank: z.number().nullable().optional(),
    country_iso_code: z.string().nullable().optional(),
    language_code: z.string().nullable().optional(),
    last_visited: z.string().nullable().optional(),
    technologies: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

type DomainTechnologiesItem = z.infer<typeof domainTechnologiesItemSchema>;

/** Detected technology stack for one domain. ~$0.01 per request. */
export async function fetchDomainTechnologies(input: {
  target: string;
}): Promise<DataforseoApiResponse<DomainTechnologiesItem[]>> {
  const response =
    await domainAnalyticsApi().technologiesDomainTechnologiesLive([
      new DomainAnalyticsTechnologiesDomainTechnologiesLiveRequestInfo({
        target: input.target,
      }),
    ]);
  const task = assertOk(response);
  return {
    data: parseTaskItems(
      "domain-technologies-live",
      task,
      domainTechnologiesItemSchema,
    ),
    billing: buildTaskBilling(task),
  };
}
