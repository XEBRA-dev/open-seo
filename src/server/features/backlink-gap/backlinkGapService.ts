import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { ReferringDomainItem } from "@/server/lib/dataforseo/backlinks";
import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { describeDomainLookupFailure } from "@/server/lib/domain-lookup-failure";

import {
  buildBacklinkGapRows,
  type BacklinkGapRow,
} from "./buildBacklinkGapRows";

// Referring domains pulled per analysed domain. Five domains at this depth is
// roughly $0.30 a run; raising it raises cost linearly.
const REFERRING_DOMAINS_PER_TARGET = 200;

type BacklinkGapResult = {
  rows: BacklinkGapRow[];
  /** Targets whose fetch failed; the rest still render. */
  failedDomains: string[];
  /** Targets where the per-domain cap was hit, so the union is partial. */
  truncatedDomains: string[];
};

/**
 * Find domains linking to a client's competitors but not to the client.
 *
 * One referring-domains call per analysed domain, unioned client-side. A failed
 * domain degrades the result rather than failing it.
 */
export async function runBacklinkGapAnalysis(params: {
  billingCustomer: BillingCustomerContext;
  clientDomain: string;
  competitorDomains: string[];
  hideSpam?: boolean;
}): Promise<BacklinkGapResult> {
  const client = createDataforseoClient(params.billingCustomer);

  const targets = [params.clientDomain, ...params.competitorDomains]
    .map((domain) => domain.trim())
    .filter((domain, index, all) => domain && all.indexOf(domain) === index);

  const settled = await Promise.allSettled(
    targets.map((target) =>
      client.backlinks.referringDomains({
        target,
        limit: REFERRING_DOMAINS_PER_TARGET,
        orderBy: ["rank,desc"],
        hideSpam: params.hideSpam ?? true,
        creditFeature: "backlinks",
      }),
    ),
  );

  const referringDomainsByTarget = new Map<string, ReferringDomainItem[]>();
  const failedDomains: string[] = [];
  const truncatedDomains: string[] = [];

  settled.forEach((outcome, index) => {
    const target = targets[index];
    if (outcome.status === "rejected") {
      console.error(
        describeDomainLookupFailure("backlink-gap", target, outcome.reason),
      );
      failedDomains.push(target);
      return;
    }
    const items = outcome.value.items;
    referringDomainsByTarget.set(target, items);
    const total = outcome.value.totalCount;
    if (total != null && total > items.length) truncatedDomains.push(target);
  });

  return {
    rows: buildBacklinkGapRows({
      clientDomain: params.clientDomain.trim(),
      referringDomainsByTarget,
    }),
    failedDomains,
    truncatedDomains,
  };
}
