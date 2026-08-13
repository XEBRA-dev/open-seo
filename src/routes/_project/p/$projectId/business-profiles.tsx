import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { BusinessProfilePage } from "@/client/features/business-profile/BusinessProfilePage";
import {
  businessProfileSearchSchema,
  parseBusinessQueries,
} from "@/types/schemas/business-profile";

export const Route = createFileRoute(
  "/_project/p/$projectId/business-profiles",
)({
  validateSearch: businessProfileSearchSchema,
  component: BusinessProfilesRoute,
});

function BusinessProfilesRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const { q, loc = "" } = Route.useSearch();

  return (
    <BusinessProfilePage
      projectId={projectId}
      queries={parseBusinessQueries(q)}
      locationName={loc}
      onSearchChange={(next) =>
        navigate({
          search: {
            q: next.queries.length ? next.queries.join(",") : undefined,
            loc: next.locationName || undefined,
          },
        })
      }
    />
  );
}
