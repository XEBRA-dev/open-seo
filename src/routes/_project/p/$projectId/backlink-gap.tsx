import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { BacklinkGapPage } from "@/client/features/backlink-gap/BacklinkGapPage";
import {
  backlinkGapSearchSchema,
  parseBacklinkCompetitors,
} from "@/types/schemas/backlink-gap";

export const Route = createFileRoute("/_project/p/$projectId/backlink-gap")({
  validateSearch: backlinkGapSearchSchema,
  component: BacklinkGapRoute,
});

function BacklinkGapRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const {
    client = "",
    competitors: rawCompetitors,
    gapOnly,
    withSpam,
  } = Route.useSearch();

  return (
    <BacklinkGapPage
      projectId={projectId}
      clientDomain={client}
      competitors={parseBacklinkCompetitors(rawCompetitors)}
      gapOnly={gapOnly ?? false}
      withSpam={withSpam ?? false}
      onSearchChange={(next) =>
        navigate({
          search: {
            client: next.client || undefined,
            competitors: next.competitors.length
              ? next.competitors.join(",")
              : undefined,
            gapOnly: next.gapOnly || undefined,
            withSpam: next.withSpam || undefined,
          },
        })
      }
    />
  );
}
