import { createServerFn } from "@tanstack/react-start";

import { runTechStackLookup } from "@/server/features/tech-stack/techStackService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { techStackInputSchema } from "@/types/schemas/tech-stack";

/** Detect what technologies a set of domains run. */
export const lookupTechStack = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(techStackInputSchema)
  .handler(async ({ data, context }) =>
    runTechStackLookup({
      billingCustomer: context,
      domains: data.domains,
    }),
  );
