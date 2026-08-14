import { describe, expect, it } from "vitest";

import { getAccessLogoutHref, shouldShowAccountMenu } from "./auth-mode";

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

// Regression guard for the bug that hid Sign out entirely on seo.xebra.dev:
// the account menu was gated on a Better Auth session email, but in Cloudflare
// Access mode Access owns the session and `useSession()` is always empty — so
// the menu never rendered and took the only Sign out control with it.
describe("shouldShowAccountMenu", () => {
  it("shows the menu in Cloudflare Access mode even with no session email", () => {
    expect(shouldShowAccountMenu(false, "cloudflare_access")).toBe(true);
  });

  it("shows the menu in Access mode when AUTH_MODE is unset (fails closed to access)", () => {
    expect(shouldShowAccountMenu(false, undefined)).toBe(true);
  });

  it("shows the menu in hosted mode once a session email exists", () => {
    expect(shouldShowAccountMenu(true, "hosted")).toBe(true);
  });

  it("hides the menu in hosted mode with no session: that user is signed out", () => {
    expect(shouldShowAccountMenu(false, "hosted")).toBe(false);
  });

  it("hides the menu in local_noauth: there is no session to end", () => {
    expect(shouldShowAccountMenu(false, "local_noauth")).toBe(false);
    expect(shouldShowAccountMenu(true, "local_noauth")).toBe(false);
  });
});
