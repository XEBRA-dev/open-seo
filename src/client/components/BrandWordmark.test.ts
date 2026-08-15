import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the single-source rule for the wordmark.
 *
 * The sidebar was rebranded to SEO.XEBRA while the mobile header kept its own
 * hardcoded "OpenSEO" link, so the brand was only correct on desktop and the
 * regression was invisible until someone opened the app on a phone. There is no
 * component-test setup here (vitest runs in node), so this asserts the
 * structural property instead: the surfaces that show the wordmark render the
 * shared component rather than their own copy.
 */
const WORDMARK_SURFACES = [
  "src/client/components/Sidebar.tsx",
  "src/client/layout/AppShell.tsx",
];

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("brand wordmark", () => {
  it.each(WORDMARK_SURFACES)("%s renders the shared wordmark", (path) => {
    expect(read(path)).toContain("BrandWordmark");
  });

  it.each(WORDMARK_SURFACES)("%s does not hardcode a wordmark", (path) => {
    const source = read(path);
    // Either literal spelled out in these files means a second copy has
    // appeared and the two surfaces can drift again.
    expect(source).not.toContain("OpenSEO");
    expect(source).not.toContain("SEO.XEBRA");
  });

  it("the shared component is the one place the wordmark text lives", () => {
    expect(read("src/client/components/BrandWordmark.tsx")).toContain(
      "SEO.XEBRA",
    );
  });
});

/**
 * The same drift in image form: public/xebra-transparent.png was added during
 * the rebrand but wired up nowhere, so seven surfaces — including the OAuth
 * consent screen shown when connecting Claude — kept serving OpenSEO's logo.
 */
describe("brand logo asset", () => {
  it("no source file still references the upstream logo", () => {
    const offenders = execSync(
      // Exclude tests: this file names the string it is banning.
      "grep -rl 'transparent-logo.png' src --include='*.tsx' --include='*.ts' --exclude='*.test.ts' --exclude='*.test.tsx' || true",
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    expect(offenders).toEqual([]);
  });
});
