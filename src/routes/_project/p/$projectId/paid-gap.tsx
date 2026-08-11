import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PaidGapPage } from "@/client/features/paid-gap/PaidGapPage";
import {
  paidGapSearchSchema,
  parseCompetitorDomains,
} from "@/types/schemas/paid-gap";

export const Route = createFileRoute("/_project/p/$projectId/paid-gap")({
  validateSearch: paidGapSearchSchema,
  component: PaidGapRoute,
});

function PaidGapRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const {
    client = "",
    competitors: rawCompetitors,
    gapOnly,
  } = Route.useSearch();

  return (
    <PaidGapPage
      projectId={projectId}
      clientDomain={client}
      competitors={parseCompetitorDomains(rawCompetitors)}
      gapOnly={gapOnly ?? false}
      onSearchChange={(next) =>
        navigate({
          search: {
            client: next.client || undefined,
            competitors: next.competitors.length
              ? next.competitors.join(",")
              : undefined,
            gapOnly: next.gapOnly || undefined,
          },
        })
      }
    />
  );
}
