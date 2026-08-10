import { describe, expect, it } from "vitest";

import type { KeywordMetricRow } from "@/server/lib/dataforseo/keyword-metrics";

import { buildPaidGapRows } from "./buildPaidGapRows";

function metric(
  keyword: string,
  overrides: Partial<KeywordMetricRow> = {},
): KeywordMetricRow {
  return {
    keyword,
    searchVolume: 100,
    cpc: 1,
    competition: 0.5,
    competitionLevel: "MEDIUM",
    keywordDifficulty: null,
    intent: null,
    monthlySearches: [],
    lowTopOfPageBid: 2,
    highTopOfPageBid: 5,
    ...overrides,
  };
}

describe("buildPaidGapRows", () => {
  it("marks which domains bid on each keyword", () => {
    const rows = buildPaidGapRows({
      clientDomain: "client.se",
      paidKeywordsByDomain: new Map([
        ["client.se", ["shared"]],
        ["rival.se", ["shared", "gap"]],
      ]),
      metrics: [metric("shared"), metric("gap")],
    });

    const shared = rows.find((row) => row.keyword === "shared")!;
    expect(shared.bidders.toSorted()).toEqual(["client.se", "rival.se"]);
    expect(shared.clientBids).toBe(true);

    const gap = rows.find((row) => row.keyword === "gap")!;
    expect(gap.bidders).toEqual(["rival.se"]);
    expect(gap.clientBids).toBe(false);
  });

  it("matches keywords case-insensitively across endpoints", () => {
    const rows = buildPaidGapRows({
      clientDomain: "client.se",
      paidKeywordsByDomain: new Map([["client.se", ["Solceller Pris"]]]),
      metrics: [metric("solceller pris")],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].clientBids).toBe(true);
    expect(rows[0].lowTopOfPageBid).toBe(2);
    // The first-seen spelling is what the user typed into the SERP, so keep it.
    expect(rows[0].keyword).toBe("Solceller Pris");
  });

  it("keeps keywords with no metrics, priced as null", () => {
    const rows = buildPaidGapRows({
      clientDomain: "client.se",
      paidKeywordsByDomain: new Map([["rival.se", ["unpriced"]]]),
      metrics: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].lowTopOfPageBid).toBeNull();
    expect(rows[0].highTopOfPageBid).toBeNull();
    expect(rows[0].searchVolume).toBeNull();
  });

  it("sorts by competitor coverage before search volume", () => {
    const rows = buildPaidGapRows({
      clientDomain: "client.se",
      paidKeywordsByDomain: new Map([
        ["a.se", ["one", "two"]],
        ["b.se", ["two"]],
      ]),
      metrics: [
        metric("one", { searchVolume: 900 }),
        metric("two", { searchVolume: 100 }),
      ],
    });

    // "two" has two competitor bidders against "one"'s single bidder, so
    // coverage outranks its much lower volume.
    expect(rows.map((row) => row.keyword)).toEqual(["two", "one"]);
  });

  it("does not count the client toward competitor coverage", () => {
    const rows = buildPaidGapRows({
      clientDomain: "client.se",
      paidKeywordsByDomain: new Map([
        ["client.se", ["clientonly"]],
        ["rival.se", ["rivalonly"]],
      ]),
      metrics: [
        metric("clientonly", { searchVolume: 5000 }),
        metric("rivalonly", { searchVolume: 10 }),
      ],
    });

    // The client's own term has zero competitor bidders despite 500x the
    // volume, so it sorts last.
    expect(rows.map((row) => row.keyword)).toEqual(["rivalonly", "clientonly"]);
  });

  it("ignores blank keywords", () => {
    const rows = buildPaidGapRows({
      clientDomain: "client.se",
      paidKeywordsByDomain: new Map([["rival.se", ["  ", "real"]]]),
      metrics: [metric("real")],
    });

    expect(rows.map((row) => row.keyword)).toEqual(["real"]);
  });
});
