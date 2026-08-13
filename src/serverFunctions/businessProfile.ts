import { createServerFn } from "@tanstack/react-start";

import { runBusinessProfileLookup } from "@/server/features/business-profile/businessProfileService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { businessProfileInputSchema } from "@/types/schemas/business-profile";

/** Compare Google Business Profiles for a client and its local competitors. */
export const lookupBusinessProfiles = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(businessProfileInputSchema)
  .handler(async ({ data, context }) =>
    runBusinessProfileLookup({
      billingCustomer: context,
      queries: data.queries,
      locationName: data.locationName,
      languageCode: data.languageCode,
    }),
  );
