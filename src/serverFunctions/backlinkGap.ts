import { createServerFn } from "@tanstack/react-start";

import { runBacklinkGapAnalysis } from "@/server/features/backlink-gap/backlinkGapService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { backlinkGapInputSchema } from "@/types/schemas/backlink-gap";

/**
 * Find domains linking to a client's competitors but not the client. Self-hosted
 * deployments pay DataForSEO directly, so there is no plan gate; the project
 * context already scopes access.
 */
export const analyseBacklinkGap = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(backlinkGapInputSchema)
  .handler(async ({ data, context }) =>
    runBacklinkGapAnalysis({
      billingCustomer: context,
      clientDomain: data.clientDomain,
      competitorDomains: data.competitorDomains,
      hideSpam: data.hideSpam,
    }),
  );
