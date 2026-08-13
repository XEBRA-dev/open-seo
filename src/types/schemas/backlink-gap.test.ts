import { describe, expect, it } from "vitest";

import {
  backlinkGapInputSchema,
  parseBacklinkCompetitors,
} from "./backlink-gap";

const valid = {
  projectId: "45e777f3-b553-4677-a171-ee2aad28a7f0",
  clientDomain: "inovela.se",
  competitorDomains: ["sveasolar.se"],
};

describe("backlinkGapInputSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(backlinkGapInputSchema.safeParse(valid).success).toBe(true);
  });

  // Regression guard: without projectId the request context has no project and
  // requireProjectContext throws INTERNAL_ERROR, which users see as a generic
  // "unexpected error".
  it("requires projectId", () => {
    const { projectId: _omitted, ...rest } = valid;
    expect(backlinkGapInputSchema.safeParse(rest).success).toBe(false);
  });

  it("requires at least one competitor", () => {
    expect(
      backlinkGapInputSchema.safeParse({ ...valid, competitorDomains: [] })
        .success,
    ).toBe(false);
  });

  it("rejects more than four competitors", () => {
    expect(
      backlinkGapInputSchema.safeParse({
        ...valid,
        competitorDomains: ["a.se", "b.se", "c.se", "d.se", "e.se"],
      }).success,
    ).toBe(false);
  });
});

describe("parseBacklinkCompetitors", () => {
  it("normalizes, dedupes and caps", () => {
    expect(
      parseBacklinkCompetitors("https://www.a.se/x, a.se , b.se, a.se"),
    ).toEqual(["a.se", "b.se"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseBacklinkCompetitors(undefined)).toEqual([]);
    expect(parseBacklinkCompetitors(" , ")).toEqual([]);
  });
});
