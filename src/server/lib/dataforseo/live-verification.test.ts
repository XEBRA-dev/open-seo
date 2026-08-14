/**
 * Opt-in verification against the real DataForSEO API.
 *
 * These tests spend real credits, so they are skipped unless DATAFORSEO_LIVE=1
 * and a key are both present:
 *
 *   DATAFORSEO_LIVE=1 DATAFORSEO_API_KEY=... pnpm vitest run live-verification
 *
 * They exist because every failure in these features so far has been a
 * request/response-shape mismatch that unit tests with recorded fixtures cannot
 * catch: the fixture encodes the same wrong assumption as the code. Only a live
 * call proves our request is accepted and our parser reads the real payload.
 */
import { describe, expect, it } from "vitest";

import { fetchReferringDomains } from "./backlinks";
import { fetchMyBusinessInfo } from "./business";
import { fetchDomainTechnologies } from "./domain-analytics";
import { fetchRankedKeywords } from "./labs";

const live =
  process.env.DATAFORSEO_LIVE === "1" && !!process.env.DATAFORSEO_API_KEY;

// Sweden, Swedish — the market these features are actually used against.
const LOCATION_CODE = 2752;
const LANGUAGE_CODE = "sv";

describe.skipIf(!live)("DataForSEO live verification", () => {
  it("domain technologies returns a parsed record", async () => {
    const result = await fetchDomainTechnologies({ target: "sveasolar.se" });

    expect(result.billing.costUsd).toBeGreaterThan(0);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.domain).toBeTruthy();
    // The whole point of the feature: a non-empty technology map.
    expect(
      Object.keys(result.data[0]?.technologies ?? {}).length,
    ).toBeGreaterThan(0);
  }, 60_000);

  it("ranked keywords returns paid-search rows for a domain that advertises", async () => {
    const result = await fetchRankedKeywords({
      target: "sveasolar.se",
      locationCode: LOCATION_CODE,
      languageCode: LANGUAGE_CODE,
      limit: 10,
    });

    expect(result.billing.costUsd).toBeGreaterThan(0);
    // Labs paginated endpoints return { items, totalCount }, not a bare array.
    expect(Array.isArray(result.data.items)).toBe(true);
  }, 60_000);

  it("referring domains returns rows", async () => {
    const result = await fetchReferringDomains({
      target: "sveasolar.se",
      limit: 10,
    });

    expect(result.billing.costUsd).toBeGreaterThan(0);
    expect(Array.isArray(result.data.items)).toBe(true);
  }, 60_000);

  it("my business info returns a profile", async () => {
    const result = await fetchMyBusinessInfo({
      keyword: "svea solar",
      locationName: "Sweden",
      languageCode: LANGUAGE_CODE,
    });

    expect(result.billing.costUsd).toBeGreaterThan(0);
    // Array.isArray alone passes on an empty array, which is exactly how the
    // tech stack bug hid: billed, "successful", and silently empty.
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.title).toBeTruthy();
  }, 60_000);

  it("referring domains items are non-empty for a domain with backlinks", async () => {
    const result = await fetchReferringDomains({
      target: "sveasolar.se",
      limit: 10,
    });

    expect(result.data.items.length).toBeGreaterThan(0);
  }, 60_000);

  it("ranked keywords items are non-empty for a domain that ranks", async () => {
    const result = await fetchRankedKeywords({
      target: "sveasolar.se",
      locationCode: LOCATION_CODE,
      languageCode: LANGUAGE_CODE,
      limit: 10,
    });

    expect(result.data.items.length).toBeGreaterThan(0);
  }, 60_000);
});
