import { createServerFn } from "@tanstack/react-start";

import { runPaidGapAnalysis } from "@/server/features/paid-gap/paidGapService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { paidGapInputSchema } from "@/types/schemas/paid-gap";

/**
 * Compare a client's paid keywords against its competitors', priced with
 * top-of-page bid ranges. Self-hosted deployments pay DataForSEO directly, so
 * there is no plan gate here — the project context already scopes access.
 */
export const analysePaidGap = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(paidGapInputSchema)
  .handler(async ({ data, context }) =>
    runPaidGapAnalysis({
      billingCustomer: context,
      clientDomain: data.clientDomain,
      competitorDomains: data.competitorDomains,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    }),
  );
