import { describe, expect, it } from "vitest";

import { getAccessLogoutHref } from "./auth-mode";

describe("getAccessLogoutHref", () => {
  it("returns to the app so Access shows the login rather than its error page", () => {
    expect(getAccessLogoutHref("https://seo.xebra.dev")).toBe(
      "/cdn-cgi/access/logout?returnTo=https%3A%2F%2Fseo.xebra.dev%2F",
    );
  });

  it("encodes the origin", () => {
    expect(getAccessLogoutHref("https://a.example.com:8443")).toContain(
      "returnTo=https%3A%2F%2Fa.example.com%3A8443%2F",
    );
  });
});
