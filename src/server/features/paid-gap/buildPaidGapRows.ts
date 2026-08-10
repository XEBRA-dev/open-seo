import type { KeywordMetricRow } from "@/server/lib/dataforseo/keyword-metrics";

export type PaidGapRow = {
  keyword: string;
  /** Domains running paid ads on this keyword, the client included. */
  bidders: string[];
  clientBids: boolean;
  searchVolume: number | null;
  cpc: number | null;
  /** Top-of-page bid range, in USD (same unit as `cpc`). */
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  competition: number | null;
  competitionLevel: string | null;
};

// Ranked-keywords and the metrics endpoints echo keywords with inconsistent
// casing, so every lookup goes through the same fold.
function fold(keyword: string): string {
  return keyword.trim().toLowerCase();
}

/**
 * Join each domain's paid keyword list against hydrated metrics into one row
 * per keyword, ordered so the widest competitor coverage surfaces first.
 *
 * Pure: all network work happens in the caller.
 */
export function buildPaidGapRows(input: {
  clientDomain: string;
  paidKeywordsByDomain: Map<string, string[]>;
  metrics: KeywordMetricRow[];
}): PaidGapRow[] {
  const metricsByKeyword = new Map(
    input.metrics.map((row) => [fold(row.keyword), row]),
  );

  // Keep the first spelling seen for display; the folded form is only a key.
  const displayByKeyword = new Map<string, string>();
  const biddersByKeyword = new Map<string, Set<string>>();

  for (const [domain, keywords] of input.paidKeywordsByDomain) {
    for (const keyword of keywords) {
      const key = fold(keyword);
      if (!key) continue;
      if (!displayByKeyword.has(key)) displayByKeyword.set(key, keyword);
      const bidders = biddersByKeyword.get(key) ?? new Set<string>();
      bidders.add(domain);
      biddersByKeyword.set(key, bidders);
    }
  }

  const rows: PaidGapRow[] = [];
  for (const [key, bidderSet] of biddersByKeyword) {
    const metrics = metricsByKeyword.get(key);
    rows.push({
      keyword: displayByKeyword.get(key) ?? key,
      bidders: [...bidderSet],
      clientBids: bidderSet.has(input.clientDomain),
      searchVolume: metrics?.searchVolume ?? null,
      cpc: metrics?.cpc ?? null,
      lowTopOfPageBid: metrics?.lowTopOfPageBid ?? null,
      highTopOfPageBid: metrics?.highTopOfPageBid ?? null,
      competition: metrics?.competition ?? null,
      competitionLevel: metrics?.competitionLevel ?? null,
    });
  }

  const competitorCount = (row: PaidGapRow) =>
    row.bidders.filter((domain) => domain !== input.clientDomain).length;

  return rows.toSorted(
    (a, b) =>
      competitorCount(b) - competitorCount(a) ||
      (b.searchVolume ?? 0) - (a.searchVolume ?? 0) ||
      a.keyword.localeCompare(b.keyword),
  );
}
