import { describe, expect, it, vi } from "vitest";

import { fetchDomainTechnologies } from "./domain-analytics";

// Shape captured from a real /v3/domain_analytics/technologies/
// domain_technologies/live response for google.com: the record sits directly
// in `result`, with NO nested `items` array. Parsing it as `result[].items`
// returned nothing for every domain, which is the bug this pins.
const liveShape = {
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

vi.mock("@/server/lib/dataforseo/core", () => ({
  domainAnalyticsApi: () => ({
    technologiesDomainTechnologiesLive: async () => liveShape,
  }),
}));

describe("fetchDomainTechnologies", () => {
  it("reads records straight from result, not result[].items", async () => {
    const { data } = await fetchDomainTechnologies({ target: "google.com" });

    expect(data).toHaveLength(1);
    expect(data[0].domain).toBe("google.com");
    expect(data[0].technologies).toEqual({
      servers: { web_servers: ["Google Web Server"] },
    });
  });
});
