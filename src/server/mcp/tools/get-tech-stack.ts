import { z } from "zod";

import { runTechStackLookup } from "@/server/features/tech-stack/techStackService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";

const inputSchema = {
  projectId: projectIdSchema,
  domains: z
    .array(z.string().min(1))
    .min(1)
    .max(5)
    .describe(
      "One to five domains, without protocol or www (e.g. 'inovela.se').",
    ),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

export const getTechStackTool = {
  name: "get_tech_stack",
  config: {
    title: "Get technology stack",
    description:
      "Detects which technologies a domain runs — CMS, ecommerce platform, analytics, hosting, JavaScript frameworks and more — for up to five domains at once. Useful for auditing a client's site or qualifying a prospect before a pitch. Returns per-domain `groups` (category to technology names) plus a flat `allTechnologies` list for quick comparison. Charges credits: roughly one request per domain.",
    inputSchema,
    outputSchema: {
      rows: z.array(looseObjectOutputSchema),
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
    const result = await runTechStackLookup({
      billingCustomer: context.billing,
      domains: args.domains,
    });

    const blocks = result.rows.map((row) => {
      const lines = [
        `## ${row.domain}${row.title ? ` — ${row.title}` : ""}`,
        row.domainRank == null ? "" : `rank: ${row.domainRank}`,
        row.groups.length === 0
          ? "No technologies detected."
          : row.groups
              .map(
                (group) =>
                  `- ${group.group} / ${group.category}: ${group.technologies.join(", ")}`,
              )
              .join("\n"),
      ].filter(Boolean);
      return lines.join("\n");
    });

    const failed = result.failedDomains.length
      ? `\n\nFailed to fetch: ${result.failedDomains.join(", ")}.`
      : "";

    return mcpResponse({
      text:
        (blocks.length ? blocks.join("\n\n") : "No domains returned data.") +
        failed,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/tech-stack`,
        { domains: args.domains.join(",") },
      ),
      structuredContent: {
        rows: result.rows,
        failedDomains: result.failedDomains,
      },
    });
  }),
};
