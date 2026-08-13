import { z } from "zod";

import { runBacklinkGapAnalysis } from "@/server/features/backlink-gap/backlinkGapService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import {
  formatMcpTable,
  readPath,
  type McpTableColumn,
} from "@/server/mcp/table";

const GAP_COLUMNS: McpTableColumn<unknown>[] = [
  {
    header: "referring domain",
    value: (row) => readPath(row, "referringDomain"),
  },
  {
    header: "links to",
    value: (row) => {
      const targets = readPath(row, "linksTo");
      return Array.isArray(targets) ? targets.join(" ") : "";
    },
  },
  {
    header: "links to client",
    value: (row) => (readPath(row, "linksToClient") ? "yes" : "no"),
  },
  { header: "rank", value: (row) => readPath(row, "rank") },
  { header: "backlinks", value: (row) => readPath(row, "backlinks") },
  { header: "spam", value: (row) => readPath(row, "spamScore") },
  { header: "first seen", value: (row) => readPath(row, "firstSeen") },
];

const inputSchema = {
  projectId: projectIdSchema,
  clientDomain: z
    .string()
    .min(1)
    .describe(
      "The client's domain, without protocol or www (e.g. 'inovela.se').",
    ),
  competitorDomains: z
    .array(z.string().min(1))
    .min(1)
    .max(4)
    .describe(
      "One to four competitor domains. Required: a gap needs something to compare against.",
    ),
  hideSpam: z
    .boolean()
    .optional()
    .describe("Filter out spammy referring domains. Defaults to true."),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const getBacklinkGapTool = {
  name: "get_backlink_gap",
  config: {
    title: "Get backlink gap",
    description:
      "Finds domains linking to a client's competitors but not to the client — the link-building shortlist. Returns one row per referring domain with `linksTo` (which analysed domains it links to), `linksToClient`, DataForSEO `rank` as an authority proxy, backlink counts, spam score and first-seen date. Rows are ordered by competitor coverage then authority, so the best prospects come first. Charges credits: one referring-domains call per analysed domain.",
    inputSchema,
    outputSchema: {
      rows: z.array(looseObjectOutputSchema),
      failedDomains: z.array(z.string()),
      truncatedDomains: z.array(z.string()),
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const result = await runBacklinkGapAnalysis({
      billingCustomer: context.billing,
      clientDomain: args.clientDomain,
      competitorDomains: args.competitorDomains,
      hideSpam: args.hideSpam,
    });

    const gapCount = result.rows.filter(
      (row) => !row.linksToClient && row.linksTo.length > 0,
    ).length;

    const notes = [
      `Backlink gap for ${args.clientDomain} vs ${args.competitorDomains.join(", ")}.`,
      `${result.rows.length} referring domains, ${gapCount} of them link to a competitor but not the client.`,
      result.truncatedDomains.length
        ? `Capped at 200 referring domains for: ${result.truncatedDomains.join(", ")}.`
        : "",
      result.failedDomains.length
        ? `Failed to fetch: ${result.failedDomains.join(", ")}.`
        : "",
    ].filter(Boolean);

    const text = [
      notes.join(" "),
      "",
      result.rows.length === 0
        ? "No referring domains found for these domains."
        : formatMcpTable(result.rows, GAP_COLUMNS),
    ].join("\n");

    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/backlink-gap`,
        { clientDomain: args.clientDomain },
      ),
      structuredContent: {
        rows: result.rows,
        failedDomains: result.failedDomains,
        truncatedDomains: result.truncatedDomains,
      },
    });
  }),
};
