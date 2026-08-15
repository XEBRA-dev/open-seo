import { describe, expect, it } from "vitest";

import { isOperatorEmail } from "./operator";

describe("isOperatorEmail", () => {
  it("accepts an address on the operator domain", () => {
    expect(isOperatorEmail("farhad@xebra.dev")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isOperatorEmail("  Farhad@XEBRA.dev ")).toBe(true);
  });

  it("rejects a customer address", () => {
    expect(isOperatorEmail("someone@client.se")).toBe(false);
  });

  // The attacks this guard exists for: both of these contain "xebra.dev" and
  // would pass a naive includes() or endsWith() on the whole address.
  it("rejects a lookalike domain", () => {
    expect(isOperatorEmail("attacker@evil-xebra.dev")).toBe(false);
  });

  it("rejects the operator domain used as a subdomain prefix", () => {
    expect(isOperatorEmail("attacker@xebra.dev.attacker.com")).toBe(false);
  });

  // An address with an @ in the local part must resolve on the LAST @.
  it("uses the final @ to find the domain", () => {
    expect(isOperatorEmail('"a@b"@xebra.dev')).toBe(true);
    expect(isOperatorEmail("a@xebra.dev@evil.com")).toBe(false);
  });

  it("rejects empty and malformed input", () => {
    expect(isOperatorEmail(null)).toBe(false);
    expect(isOperatorEmail(undefined)).toBe(false);
    expect(isOperatorEmail("")).toBe(false);
    expect(isOperatorEmail("no-at-sign")).toBe(false);
  });

  it("honours a configured domain", () => {
    expect(isOperatorEmail("a@other.com", "other.com")).toBe(true);
    expect(isOperatorEmail("a@xebra.dev", "other.com")).toBe(false);
  });
});
