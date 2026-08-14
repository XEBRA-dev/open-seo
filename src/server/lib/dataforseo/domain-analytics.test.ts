import { describe, expect, it, vi } from "vitest";

import { fetchDomainTechnologies } from "./domain-analytics";

// Shape captured from a real /v3/domain_analytics/technologies/
// domain_technologies/live response for google.com: the record sits directly
// in `result`, with NO nested `items` array. Parsing it as `result[].items`
// returned nothing for every domain, which is the bug this pins.
const plainJsonShape = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      id: "t",
      status_code: 20000,
      status_message: "Ok.",
      cost: 0.012,
      path: [
        "v3",
        "domain_analytics",
        "technologies",
        "domain_technologies",
        "live",
      ],
      result: [
        {
          domain: "google.com",
          title: "Google",
          domain_rank: 1000,
          country_iso_code: "US",
          technologies: { servers: { web_servers: ["Google Web Server"] } },
        },
      ],
    },
  ],
};

// What the SDK actually hands back. It does not return plain JSON — it
// deserializes into generated classes, so `technologies` arrives as a
// TechnologiesInfo instance rather than an object literal. Zod v4's
// z.record() rejects any non-plain object, so validating the SDK value
// directly dropped every row while the plain-JSON fixture above kept passing:
// the fixture encoded a shape the SDK never produces.
class TechnologiesInfo {
  constructor(init: Record<string, unknown>) {
    Object.assign(this, init);
  }

  // The generated SDK classes serialize back to the wire shape; keeping that
  // here is what lets the fix (JSON round-trip) work against a faithful double.
  toJSON(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this));
  }
}

class DomainTechnologiesResultInfo {
  constructor(init: Record<string, unknown>) {
    Object.assign(this, init);
  }

  toJSON(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this));
  }
}

const sdkClassShape = {
  ...plainJsonShape,
  tasks: [
    {
      ...plainJsonShape.tasks[0],
      result: [
        new DomainTechnologiesResultInfo({
          domain: "google.com",
          title: "Google",
          domain_rank: 1000,
          country_iso_code: "US",
          technologies: new TechnologiesInfo({
            servers: new TechnologiesInfo({
              web_servers: ["Google Web Server"],
            }),
          }),
        }),
      ],
    },
  ],
};

let response: unknown = plainJsonShape;

vi.mock("@/server/lib/dataforseo/core", () => ({
  domainAnalyticsApi: () => ({
    technologiesDomainTechnologiesLive: async () => response,
  }),
}));

describe("fetchDomainTechnologies", () => {
  it("reads records straight from result, not result[].items", async () => {
    response = plainJsonShape;

    const { data } = await fetchDomainTechnologies({ target: "google.com" });

    expect(data).toHaveLength(1);
    expect(data[0].domain).toBe("google.com");
    expect(data[0].technologies).toEqual({
      servers: { web_servers: ["Google Web Server"] },
    });
  });

  it("parses the SDK's class instances, not just plain JSON", async () => {
    response = sdkClassShape;

    const { data } = await fetchDomainTechnologies({ target: "google.com" });

    expect(data).toHaveLength(1);
    expect(data[0].domain).toBe("google.com");
    // Must survive as a plain, walkable map — flattenTechnologies iterates it.
    expect(data[0].technologies).toEqual({
      servers: { web_servers: ["Google Web Server"] },
    });
  });
});
