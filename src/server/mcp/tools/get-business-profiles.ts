import { z } from "zod";

import { runBusinessProfileLookup } from "@/server/features/business-profile/businessProfileService";
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

const COLUMNS: McpTableColumn<unknown>[] = [
  { header: "business", value: (row) => readPath(row, "title") },
  { header: "rating", value: (row) => readPath(row, "rating") },
  { header: "reviews", value: (row) => readPath(row, "reviewCount") },
  {
    header: "claimed",
    value: (row) => (readPath(row, "isClaimed") ? "yes" : "no"),
  },
  { header: "category", value: (row) => readPath(row, "category") },
  { header: "domain", value: (row) => readPath(row, "domain") },
];

const inputSchema = {
  projectId: projectIdSchema,
  queries: z
    .array(z.string().min(1))
    .min(1)
    .max(5)
    .describe(
      "One to five business names to look up, e.g. ['Inovela', 'Svea Solar'].",
    ),
  locationName: z
    .string()
    .optional()
    .describe(
      "Canonical DataForSEO location name to disambiguate, e.g. 'Stockholm,Sweden'.",
    ),
  languageCode: z.string().optional().describe("Language code, e.g. 'sv'."),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const getBusinessProfilesTool = {
  name: "get_business_profiles",
  config: {
    title: "Get Google Business Profiles",
    description:
      "Compares Google Business Profiles for up to five businesses: star rating, review count, claim status, category, address and website. Rating and review volume are two of the strongest local-pack ranking signals, so this is how you see whether a client is behind its local competitors. Note this returns profile metrics, not review text — DataForSEO's review endpoints are task-based and not available synchronously. Charges credits: one request per business.",
    inputSchema,
    outputSchema: {
      rows: z.array(looseObjectOutputSchema),
      failedQueries: z.array(z.string()),
      ...optionalMetaOutputSchema,
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const result = await runBusinessProfileLookup({
      billingCustomer: context.billing,
      queries: args.queries,
      locationName: args.locationName,
      languageCode: args.languageCode,
    });

    const missing = result.rows.filter((row) => !row.found).map((r) => r.query);
    const notes = [
      `${result.rows.filter((r) => r.found).length} of ${args.queries.length} profiles found, strongest first.`,
      missing.length ? `No profile found for: ${missing.join(", ")}.` : "",
      result.failedQueries.length
        ? `Failed to fetch: ${result.failedQueries.join(", ")}.`
        : "",
    ].filter(Boolean);

    return mcpResponse({
      text: [
        notes.join(" "),
        "",
        result.rows.length === 0
          ? "No profiles returned."
          : formatMcpTable(
              result.rows.filter((row) => row.found),
              COLUMNS,
            ),
      ].join("\n"),
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/business-profiles`,
        { queries: args.queries.join(",") },
      ),
      structuredContent: {
        rows: result.rows,
        failedQueries: result.failedQueries,
      },
    });
  }),
};
