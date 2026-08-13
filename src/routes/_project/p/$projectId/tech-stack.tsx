import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { TechStackPage } from "@/client/features/tech-stack/TechStackPage";
import {
  parseTechStackDomains,
  techStackSearchSchema,
} from "@/types/schemas/tech-stack";

export const Route = createFileRoute("/_project/p/$projectId/tech-stack")({
  validateSearch: techStackSearchSchema,
  component: TechStackRoute,
});

function TechStackRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const { domains: rawDomains } = Route.useSearch();

  return (
    <TechStackPage
      projectId={projectId}
      domains={parseTechStackDomains(rawDomains)}
      onSearchChange={(next) =>
        navigate({
          search: { domains: next.length ? next.join(",") : undefined },
        })
      }
    />
  );
}
