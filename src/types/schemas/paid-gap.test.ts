import { describe, expect, it } from "vitest";

import { paidGapInputSchema, parseCompetitorDomains } from "./paid-gap";

const valid = {
  projectId: "45e777f3-b553-4677-a171-ee2aad28a7f0",
  clientDomain: "inovela.se",
  competitorDomains: ["sveasolar.se"],
  locationCode: 2752,
  languageCode: "sv",
};

describe("paidGapInputSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(paidGapInputSchema.safeParse(valid).success).toBe(true);
  });

  // Regression guard: ensureUserMiddleware reads projectId off the request
  // payload to attach the project to the request context. Omitting it made
  // every call fail with INTERNAL_ERROR ("Project context missing"), which
  // surfaces to users as a generic "unexpected error".
  it("requires projectId so the project context can be resolved", () => {
    const { projectId: _omitted, ...withoutProjectId } = valid;
    expect(paidGapInputSchema.safeParse(withoutProjectId).success).toBe(false);
  });

  it("rejects more than four competitors", () => {
    const tooMany = {
      ...valid,
      competitorDomains: ["a.se", "b.se", "c.se", "d.se", "e.se"],
    };
    expect(paidGapInputSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe("parseCompetitorDomains", () => {
  it("normalizes, dedupes and caps the list", () => {
    expect(
      parseCompetitorDomains("https://www.a.se/x, a.se , b.se, a.se"),
    ).toEqual(["a.se", "b.se"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseCompetitorDomains(undefined)).toEqual([]);
    expect(parseCompetitorDomains("  ,  ")).toEqual([]);
  });
});
