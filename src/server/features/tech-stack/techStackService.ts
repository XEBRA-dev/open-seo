import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { describeDomainLookupFailure } from "@/server/lib/domain-lookup-failure";
import { TECH_STACK_MAX_DOMAINS } from "@/types/schemas/tech-stack";

import { flattenTechnologies, type TechStackRow } from "./flattenTechnologies";

type TechStackResult = {
  rows: TechStackRow[];
  failedDomains: string[];
};

/**
 * Detect the technology stack of up to five domains, one request each
 * (~$0.01 per domain). A failed domain degrades the result rather than
 * failing it.
 */
export async function runTechStackLookup(params: {
  billingCustomer: BillingCustomerContext;
  domains: string[];
}): Promise<TechStackResult> {
  const client = createDataforseoClient(params.billingCustomer);

  const targets = params.domains
    .map((domain) => domain.trim())
    .filter((domain, index, all) => domain && all.indexOf(domain) === index)
    .slice(0, TECH_STACK_MAX_DOMAINS);

  const settled = await Promise.allSettled(
    targets.map((target) => client.domain.technologies({ target })),
  );

  const rows: TechStackRow[] = [];
  const failedDomains: string[] = [];

  settled.forEach((outcome, index) => {
    const target = targets[index];
    if (outcome.status === "rejected") {
      console.error(
        describeDomainLookupFailure("tech-stack", target, outcome.reason),
      );
      failedDomains.push(target);
      return;
    }
    const item = outcome.value[0];
    const { groups, allTechnologies } = flattenTechnologies(
      item?.technologies ?? null,
    );
    rows.push({
      domain: item?.domain ?? target,
      title: item?.title ?? null,
      domainRank: item?.domain_rank ?? null,
      countryCode: item?.country_iso_code ?? null,
      lastVisited: item?.last_visited ?? null,
      groups,
      allTechnologies,
    });
  });

  return { rows, failedDomains };
}
