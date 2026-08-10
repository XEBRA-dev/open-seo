import { z } from "zod";

import { runPaidGapAnalysis } from "@/server/features/paid-gap/paidGapService";
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
import { resolveMarket } from "@/shared/keyword-locations";

const GAP_COLUMNS: McpTableColumn<unknown>[] = [
  { header: "keyword", value: (row) => readPath(row, "keyword") },
  {
    header: "bidders",
    value: (row) => {
      const bidders = readPath(row, "bidders");
      return Array.isArray(bidders) ? bidders.join(" ") : "";
    },
  },
  {
    header: "client bids",
    value: (row) => (readPath(row, "clientBids") ? "yes" : "no"),
  },
  { header: "low bid", value: (row) => readPath(row, "lowTopOfPageBid") },
  { header: "high bid", value: (row) => readPath(row, "highTopOfPageBid") },
  { header: "cpc", value: (row) => readPath(row, "cpc") },
  { header: "competition", value: (row) => readPath(row, "competitionLevel") },
  { header: "volume", value: (row) => readPath(row, "searchVolume") },
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
    .max(4)
    .optional()
    .describe(
      "Up to four competitor domains to compare against. Omit to price only the client's own paid keywords.",
    ),
  locationCode: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "DataForSEO location code. Defaults to the project's default market (see list_projects).",
    ),
  languageCode: z
    .string()
    .optional()
    .describe(
      "Language code (e.g. 'sv', 'en'). Defaults to the project's default market language.",
    ),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const getPaidKeywordGapTool = {
  name: "get_paid_keyword_gap",
  config: {
    title: "Get paid keyword gap",
    description:
      "Compares which keywords a client and its competitors buy Google Ads on, with each keyword's top-of-page bid range, CPC, competition and search volume. All money is in USD. Use it to find terms competitors bid on that the client does not. Charges credits: one ranked-keywords call per domain plus one keyword-metrics call for the union.",
    inputSchema,
    outputSchema: {
      rows: z.array(looseObjectOutputSchema),
      truncated: z.boolean(),
      keywordCount: z.number(),
      failedDomains: z.array(z.string()),
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const { locationCode, languageCode } = resolveMarket(args, context.project);
    const competitorDomains = args.competitorDomains ?? [];

    const result = await runPaidGapAnalysis({
      billingCustomer: context.billing,
      clientDomain: args.clientDomain,
      competitorDomains,
      locationCode,
      languageCode,
    });

    const notes = [
      `Paid keyword gap for ${args.clientDomain} vs ${
        competitorDomains.length
          ? competitorDomains.join(", ")
          : "no competitors"
      }.`,
      `${result.rows.length} keywords. Bid range and CPC in USD.`,
      result.truncated
        ? `Truncated: ${result.keywordCount} keywords found, first 700 priced.`
        : "",
      result.failedDomains.length
        ? `Failed to fetch: ${result.failedDomains.join(", ")}.`
        : "",
    ].filter(Boolean);

    const text = [
      notes.join(" "),
      "",
      result.rows.length === 0
        ? "No paid keywords found for any of these domains."
        : formatMcpTable(result.rows, GAP_COLUMNS),
    ].join("\n");

    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/paid-gap`,
        { clientDomain: args.clientDomain },
      ),
      structuredContent: {
        rows: result.rows,
        truncated: result.truncated,
        keywordCount: result.keywordCount,
        failedDomains: result.failedDomains,
      },
    });
  }),
};
