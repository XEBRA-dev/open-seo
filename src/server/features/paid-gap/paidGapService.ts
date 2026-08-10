import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { fetchKeywordMetricsForList } from "@/server/lib/dataforseo/keyword-metrics";

import { buildPaidGapRows, type PaidGapRow } from "./buildPaidGapRows";

// Matches KEYWORD_METRICS_BATCH_SIZE in keyword-metrics.ts. The union is priced
// in a single hydration pass, so anything beyond this is reported rather than
// silently dropped.
const MAX_UNION_KEYWORDS = 700;

// Per-domain ceiling on paid keywords pulled from ranked-keywords. Four
// competitors at this depth still fits the union cap.
const PAID_KEYWORDS_PER_DOMAIN = 200;

export type PaidGapResult = {
  rows: PaidGapRow[];
  /** True when more keywords were found than could be priced in one pass. */
  truncated: boolean;
  /** Total distinct keywords found, before truncation. */
  keywordCount: number;
  /** Domains whose fetch failed; the remaining domains still render. */
  failedDomains: string[];
};

/**
 * Compare which keywords a client and its competitors buy ads on, priced with
 * top-of-page bid ranges.
 *
 * Makes one ranked-keywords call per domain plus one metrics call for the
 * union. A failed domain degrades the result rather than failing it.
 */
export async function runPaidGapAnalysis(params: {
  billingCustomer: BillingCustomerContext;
  clientDomain: string;
  competitorDomains: string[];
  locationCode: number;
  languageCode: string;
}): Promise<PaidGapResult> {
  const client = createDataforseoClient(params.billingCustomer);

  const domains = [params.clientDomain, ...params.competitorDomains]
    .map((domain) => domain.trim())
    .filter((domain, index, all) => domain && all.indexOf(domain) === index);

  const settled = await Promise.allSettled(
    domains.map((domain) =>
      client.domain.rankedKeywords({
        target: domain,
        locationCode: params.locationCode,
        languageCode: params.languageCode,
        limit: PAID_KEYWORDS_PER_DOMAIN,
        itemTypes: ["paid"],
        creditFeature: "keyword_research",
      }),
    ),
  );

  const paidKeywordsByDomain = new Map<string, string[]>();
  const failedDomains: string[] = [];

  settled.forEach((outcome, index) => {
    const domain = domains[index];
    if (outcome.status === "rejected") {
      failedDomains.push(domain);
      return;
    }
    paidKeywordsByDomain.set(
      domain,
      outcome.value.items
        .map((item) => item.keyword_data?.keyword ?? "")
        .filter(Boolean),
    );
  });

  const union = [
    ...new Set(
      [...paidKeywordsByDomain.values()]
        .flat()
        .map((keyword) => keyword.toLowerCase()),
    ),
  ];
  const truncated = union.length > MAX_UNION_KEYWORDS;
  const keywords = union.slice(0, MAX_UNION_KEYWORDS);

  const metrics = keywords.length
    ? await fetchKeywordMetricsForList(client, {
        keywords,
        locationCode: params.locationCode,
        languageCode: params.languageCode,
        creditFeature: "keyword_research",
      })
    : [];

  return {
    rows: buildPaidGapRows({
      clientDomain: params.clientDomain.trim(),
      paidKeywordsByDomain,
      metrics,
    }),
    truncated,
    keywordCount: union.length,
    failedDomains,
  };
}
