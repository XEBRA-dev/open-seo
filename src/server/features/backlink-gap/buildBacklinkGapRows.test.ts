import { describe, expect, it } from "vitest";

import type { ReferringDomainItem } from "@/server/lib/dataforseo/backlinks";

import { buildBacklinkGapRows } from "./buildBacklinkGapRows";

function ref(
  domain: string,
  over: Partial<ReferringDomainItem> = {},
): ReferringDomainItem {
  return {
    domain,
    backlinks: 5,
    referring_pages: 2,
    rank: 50,
    first_seen: "2026-01-01 00:00:00 +00:00",
    backlinks_spam_score: 3,
    ...over,
  } as ReferringDomainItem;
}

describe("buildBacklinkGapRows", () => {
  it("marks which analysed domains each referrer links to", () => {
    const rows = buildBacklinkGapRows({
      clientDomain: "client.se",
      referringDomainsByTarget: new Map([
        ["client.se", [ref("shared.se")]],
        ["rival.se", [ref("shared.se"), ref("gap.se")]],
      ]),
    });

    const shared = rows.find((r) => r.referringDomain === "shared.se")!;
    expect(shared.linksTo.toSorted()).toEqual(["client.se", "rival.se"]);
    expect(shared.linksToClient).toBe(true);

    const gap = rows.find((r) => r.referringDomain === "gap.se")!;
    expect(gap.linksTo).toEqual(["rival.se"]);
    expect(gap.linksToClient).toBe(false);
  });

  it("matches referring domains case-insensitively", () => {
    const rows = buildBacklinkGapRows({
      clientDomain: "client.se",
      referringDomainsByTarget: new Map([
        ["client.se", [ref("Example.SE")]],
        ["rival.se", [ref("example.se")]],
      ]),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].linksTo.toSorted()).toEqual(["client.se", "rival.se"]);
    // First spelling seen is kept for display.
    expect(rows[0].referringDomain).toBe("Example.SE");
  });

  it("carries metrics from the first row that has them", () => {
    const rows = buildBacklinkGapRows({
      clientDomain: "client.se",
      referringDomainsByTarget: new Map([
        ["rival.se", [ref("a.se", { rank: 80, backlinks: 12 })]],
      ]),
    });

    expect(rows[0].rank).toBe(80);
    expect(rows[0].backlinks).toBe(12);
    expect(rows[0].spamScore).toBe(3);
  });

  it("tolerates missing metrics", () => {
    const rows = buildBacklinkGapRows({
      clientDomain: "client.se",
      referringDomainsByTarget: new Map([
        ["rival.se", [{ domain: "sparse.se" } as ReferringDomainItem]],
      ]),
    });

    expect(rows[0].rank).toBeNull();
    expect(rows[0].backlinks).toBeNull();
    expect(rows[0].firstSeen).toBeNull();
  });

  it("sorts by competitor coverage, then authority", () => {
    const rows = buildBacklinkGapRows({
      clientDomain: "client.se",
      referringDomainsByTarget: new Map([
        [
          "a.se",
          [ref("wide.se", { rank: 10 }), ref("strong.se", { rank: 90 })],
        ],
        ["b.se", [ref("wide.se", { rank: 10 })]],
      ]),
    });

    // wide.se has two competitor links against strong.se's one, so coverage
    // outranks its much lower authority.
    expect(rows.map((r) => r.referringDomain)).toEqual([
      "wide.se",
      "strong.se",
    ]);
  });

  it("ignores rows without a domain", () => {
    const rows = buildBacklinkGapRows({
      clientDomain: "client.se",
      referringDomainsByTarget: new Map([
        ["rival.se", [{ domain: null } as ReferringDomainItem, ref("real.se")]],
      ]),
    });

    expect(rows.map((r) => r.referringDomain)).toEqual(["real.se"]);
  });
});
