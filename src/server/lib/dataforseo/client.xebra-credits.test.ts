import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as EnvelopeModule from "@/server/lib/dataforseo/envelope";

const {
  assertCreditsAvailableMock,
  getOrgBillingPolicyMock,
  recordSpendMock,
  getOptionalEnvValueMock,
} = vi.hoisted(() => ({
  assertCreditsAvailableMock: vi.fn(),
  getOrgBillingPolicyMock: vi.fn(),
  recordSpendMock: vi.fn(),
  getOptionalEnvValueMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ waitUntil: vi.fn() }));

vi.mock("@/server/lib/runtime-env", () => ({
  // false, so a passing test proves the XEBRA branch ran rather than the
  // hosted/Autumn one.
  isHostedServerAuthMode: async () => false,
  getOptionalEnvValue: getOptionalEnvValueMock,
}));

vi.mock("@/server/billing/credits/creditLedger", () => ({
  assertCreditsAvailable: assertCreditsAvailableMock,
  getOrgBillingPolicy: getOrgBillingPolicyMock,
  recordSpend: recordSpendMock,
}));

const customer = {
  organizationId: "org-1",
  userId: "user-1",
  userEmail: "a@xebra.dev",
};

const billing = { costUsd: 0.012, path: ["v3", "x"], taskId: "t" };

/**
 * client.ts memoizes the loaded section barrel at module scope, so each case
 * has to reset modules to install a different section stub. This is the
 * documented exception to the "no per-test dynamic import" rule: the cached
 * sections promise IS the module-level state under test.
 */
async function callTechnologies(
  fetchDomainTechnologies: () => Promise<unknown>,
) {
  return callWithFreshEnvelope(() => fetchDomainTechnologies);
}

/**
 * Builds the section stub from the SAME envelope module instance the client
 * will import. resetModules gives the fresh client a fresh
 * DataforseoChargedTaskError class, so an error constructed from a
 * statically-imported one fails `instanceof` inside the client and the test
 * reports a spend-recording bug that does not exist in production, where the
 * module is a singleton.
 */
async function callWithFreshEnvelope(
  buildFetcher: (envelope: typeof EnvelopeModule) => () => Promise<unknown>,
) {
  vi.resetModules();
  const envelope = await import("@/server/lib/dataforseo/envelope");
  vi.doMock("@/server/lib/dataforseo/sections", () => ({
    fetchDomainTechnologies: buildFetcher(envelope),
  }));
  const { createDataforseoClient } =
    await import("@/server/lib/dataforseo/client");
  return createDataforseoClient(customer).domain.technologies({
    target: "example.com",
  });
}

beforeEach(() => {
  getOptionalEnvValueMock.mockResolvedValue("xebra");
  getOrgBillingPolicyMock.mockResolvedValue({
    mode: "metered",
    markupBps: 12500,
  });
  recordSpendMock.mockResolvedValue(15);
  assertCreditsAvailableMock.mockResolvedValue(undefined);
});

describe("XEBRA credit metering", () => {
  it("checks the balance before the call and records the spend after", async () => {
    await callTechnologies(async () => ({ data: [{ ok: true }], billing }));

    expect(assertCreditsAvailableMock).toHaveBeenCalledWith("org-1");
    expect(recordSpendMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      rawCostUsd: 0.012,
      markupBps: 12500,
    });
  });

  it("does not call the API at all when the balance check refuses", async () => {
    assertCreditsAvailableMock.mockRejectedValue(new Error("no credits"));
    const fetcher = vi.fn();

    await expect(callTechnologies(fetcher)).rejects.toThrow("no credits");

    expect(fetcher).not.toHaveBeenCalled();
    expect(recordSpendMock).not.toHaveBeenCalled();
  });

  it("skips the balance check for unlimited orgs but still records cost", async () => {
    getOrgBillingPolicyMock.mockResolvedValue({
      mode: "unlimited",
      markupBps: 10000,
    });

    await callTechnologies(async () => ({ data: [], billing }));

    expect(assertCreditsAvailableMock).not.toHaveBeenCalled();
    // XEBRA's own usage is still recorded — the ledger doubles as the internal
    // cost report.
    expect(recordSpendMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      rawCostUsd: 0.012,
      markupBps: 10000,
    });
  });

  // The one that costs real money if it regresses: DataForSEO billed us, then
  // the task failed. The spend must still land or the margin is silently eaten.
  it("records the spend when a charged call throws", async () => {
    await expect(
      callWithFreshEnvelope(({ DataforseoChargedTaskError }) => async () => {
        throw new DataforseoChargedTaskError("boom", billing, false);
      }),
    ).rejects.toThrow("boom");

    expect(recordSpendMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      rawCostUsd: 0.012,
      markupBps: 12500,
    });
  });

  it("does not charge for a malformed request DataForSEO did not bill", async () => {
    await expect(
      callWithFreshEnvelope(({ DataforseoChargedTaskError }) => async () => {
        throw new DataforseoChargedTaskError(
          "Invalid Field",
          { ...billing, costUsd: 0 },
          true,
        );
      }),
    ).rejects.toThrow();

    expect(recordSpendMock).not.toHaveBeenCalled();
  });

  it("leaves metering entirely alone when BILLING_PROVIDER is unset", async () => {
    getOptionalEnvValueMock.mockResolvedValue(undefined);

    await callTechnologies(async () => ({ data: [], billing }));

    expect(getOrgBillingPolicyMock).not.toHaveBeenCalled();
    expect(recordSpendMock).not.toHaveBeenCalled();
  });
});
