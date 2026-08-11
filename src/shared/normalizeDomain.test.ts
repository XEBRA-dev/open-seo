import { describe, expect, it } from "vitest";

import { normalizeDomain } from "./normalizeDomain";

describe("normalizeDomain", () => {
  it("strips the scheme", () => {
    expect(normalizeDomain("https://inovela.se")).toBe("inovela.se");
    expect(normalizeDomain("http://inovela.se")).toBe("inovela.se");
  });

  it("strips www, paths, queries and ports", () => {
    expect(normalizeDomain("https://www.inovela.se/om-oss?a=1#top")).toBe(
      "inovela.se",
    );
    expect(normalizeDomain("inovela.se:8080")).toBe("inovela.se");
  });

  it("lowercases and trims", () => {
    expect(normalizeDomain("  Inovela.SE  ")).toBe("inovela.se");
  });

  it("leaves a bare domain untouched", () => {
    expect(normalizeDomain("sveasolar.se")).toBe("sveasolar.se");
  });

  it("keeps subdomains other than www", () => {
    expect(normalizeDomain("https://shop.inovela.se")).toBe("shop.inovela.se");
  });

  it("returns an empty string for unusable input", () => {
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain("   ")).toBe("");
    expect(normalizeDomain("https://")).toBe("");
  });
});
