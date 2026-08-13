import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { BUSINESS_PROFILE_MAX_BUSINESSES } from "@/types/schemas/business-profile";

type BusinessProfileRow = {
  /** What was searched for, so an empty result can still be shown. */
  query: string;
  found: boolean;
  title: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  domain: string | null;
  isClaimed: boolean | null;
  rating: number | null;
  reviewCount: number | null;
};

type BusinessProfileResult = {
  rows: BusinessProfileRow[];
  failedQueries: string[];
};

/**
 * Compare Google Business Profiles — rating, review volume, claim status and
 * profile completeness — for a client and its local competitors.
 *
 * Uses the live my-business-info endpoint. The reviews endpoints are
 * task-based (post, poll, collect), which would need stored tasks and a
 * background job; rating and review counts are the parts that actually drive
 * map-pack ranking and are available synchronously.
 */
export async function runBusinessProfileLookup(params: {
  billingCustomer: BillingCustomerContext;
  queries: string[];
  locationName?: string;
  languageCode?: string;
}): Promise<BusinessProfileResult> {
  const client = createDataforseoClient(params.billingCustomer);

  const queries = params.queries
    .map((query) => query.trim())
    .filter((query, index, all) => query && all.indexOf(query) === index)
    .slice(0, BUSINESS_PROFILE_MAX_BUSINESSES);

  const settled = await Promise.allSettled(
    queries.map((keyword) =>
      client.business.myBusinessInfo({
        keyword,
        locationName: params.locationName,
        languageCode: params.languageCode,
      }),
    ),
  );

  const rows: BusinessProfileRow[] = [];
  const failedQueries: string[] = [];

  settled.forEach((outcome, index) => {
    const query = queries[index];
    if (outcome.status === "rejected") {
      failedQueries.push(query);
      return;
    }
    const item = outcome.value[0];
    rows.push({
      query,
      found: item !== undefined,
      title: item?.title ?? null,
      category: item?.category ?? null,
      address: item?.address ?? null,
      phone: item?.phone ?? null,
      domain: item?.domain ?? null,
      isClaimed: item?.is_claimed ?? null,
      rating: item?.rating?.value ?? null,
      reviewCount: item?.rating?.votes_count ?? null,
    });
  });

  // Strongest profile first: rating, then review volume as the tie-break.
  return {
    rows: rows.toSorted(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    ),
    failedQueries,
  };
}
