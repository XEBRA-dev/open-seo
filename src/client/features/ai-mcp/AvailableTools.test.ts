import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The tools page is a hand-maintained list, so it silently drifts whenever a
// tool is added. Comparing the two sources by text keeps this test free of the
// MCP SDK, which must not be pulled into the eager bundle graph.
const TOOLS_DIR = "src/server/mcp/tools";
const PAGE = "src/client/features/ai-mcp/AvailableTools.tsx";

function namesIn(source: string): Set<string> {
  return new Set([...source.matchAll(/name:\s*"([a-z_]+)"/g)].map((m) => m[1]));
}

function registeredToolNames(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(TOOLS_DIR)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    for (const name of namesIn(readFileSync(join(TOOLS_DIR, file), "utf8"))) {
      names.add(name);
    }
  }
  return names;
}

describe("MCP tools page", () => {
  it("lists every tool the server defines", () => {
    const listed = namesIn(readFileSync(PAGE, "utf8"));
    const missing = [...registeredToolNames()].filter((n) => !listed.has(n));
    expect(missing).toEqual([]);
  });

  it("does not advertise tools that no longer exist", () => {
    const defined = registeredToolNames();
    const stale = [...namesIn(readFileSync(PAGE, "utf8"))].filter(
      (n) => !defined.has(n),
    );
    expect(stale).toEqual([]);
  });
});
