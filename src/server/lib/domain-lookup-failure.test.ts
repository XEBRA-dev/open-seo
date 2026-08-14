import { describe, expect, it } from "vitest";

import { describeDomainLookupFailure } from "./domain-lookup-failure";

describe("describeDomainLookupFailure", () => {
  it("names the feature and domain so the log is greppable", () => {
    const line = describeDomainLookupFailure(
      "tech-stack",
      "sveasolar.se",
      new Error("boom"),
    );
    expect(line).toContain("tech-stack");
    expect(line).toContain("sveasolar.se");
  });

  // The whole point of this helper: the reason is what distinguishes an auth
  // failure from a rate limit from an unknown domain. Losing it is the bug.
  it("includes the underlying error message", () => {
    expect(
      describeDomainLookupFailure(
        "tech-stack",
        "sveasolar.se",
        new Error("40100 unauthorized"),
      ),
    ).toContain("40100 unauthorized");
  });

  it("handles a non-Error rejection without throwing", () => {
    expect(
      describeDomainLookupFailure("paid-gap", "a.se", "plain string"),
    ).toContain("plain string");
    expect(
      describeDomainLookupFailure("paid-gap", "a.se", undefined),
    ).toContain("undefined");
  });
});
