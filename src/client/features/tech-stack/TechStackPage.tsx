import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";

import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { lookupTechStack } from "@/serverFunctions/techStack";
import {
  parseTechStackDomains,
  TECH_STACK_MAX_DOMAINS,
} from "@/types/schemas/tech-stack";

type Props = {
  projectId: string;
  domains: string[];
  onSearchChange: (domains: string[]) => void;
};

export function TechStackPage({ projectId, domains, onSearchChange }: Props) {
  const [domainsInput, setDomainsInput] = useState(domains.join(", "));

  const domainKey = domains.join(",");
  const hasSearch = domains.length > 0;

  const stackQuery = useQuery({
    queryKey: ["tech-stack", projectId, domainKey],
    queryFn: () => lookupTechStack({ data: { projectId, domains } }),
    enabled: hasSearch,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const draft = parseTechStackDomains(domainsInput);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearchChange(draft);
  }

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Tech stack</h1>
          <p className="text-base-content/60 text-sm">
            What a site is built with — CMS, ecommerce platform, analytics,
            hosting and frameworks. Useful for auditing a client or qualifying a
            prospect before a pitch.
          </p>
        </div>

        <div className="card bg-base-100 border-base-300 border">
          <div className="card-body gap-4">
            <form className="space-y-3" onSubmit={submit}>
              <label className="form-control">
                <span className="label-text mb-1">
                  Domains (up to {TECH_STACK_MAX_DOMAINS}, comma separated)
                </span>
                <input
                  className="input input-bordered w-full"
                  value={domainsInput}
                  onChange={(event) => setDomainsInput(event.target.value)}
                  placeholder="inovela.se, sveasolar.se"
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary shrink-0 px-6"
                  disabled={draft.length === 0}
                >
                  {stackQuery.isFetching ? "Detecting..." : "Detect"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {stackQuery.isError && (
          <div className="alert alert-error">
            <span>{getStandardErrorMessage(stackQuery.error)}</span>
          </div>
        )}

        {stackQuery.data && stackQuery.data.failedDomains.length > 0 && (
          <div className="alert alert-warning py-2">
            <span className="text-sm">
              Could not fetch {stackQuery.data.failedDomains.join(", ")}.
            </span>
          </div>
        )}

        {!hasSearch && (
          <div className="border-base-300 text-base-content/55 flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm">
            <Layers className="size-6" />
            <p>
              Enter up to {TECH_STACK_MAX_DOMAINS} domains to see what they run.
            </p>
          </div>
        )}

        {hasSearch && stackQuery.isPending && (
          <div className="flex justify-center p-10">
            <span className="loading loading-spinner" />
          </div>
        )}

        {stackQuery.isSuccess && (
          <div className="grid gap-4 lg:grid-cols-2">
            {stackQuery.data.rows.map((row) => (
              <div
                key={row.domain}
                className="card bg-base-100 border-base-300 border"
              >
                <div className="card-body gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{row.domain}</h2>
                    {row.title && (
                      <p className="text-base-content/60 text-sm">
                        {row.title}
                      </p>
                    )}
                    <p className="text-base-content/50 text-xs">
                      {row.domainRank == null ? null : `Rank ${row.domainRank}`}
                      {row.countryCode ? ` · ${row.countryCode}` : ""}
                      {` · ${row.allTechnologies.length} technologies`}
                    </p>
                  </div>

                  {row.groups.length === 0 ? (
                    <p className="text-base-content/55 text-sm">
                      No technologies detected for this domain.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {row.groups.map((group) => (
                        <div key={`${group.group}/${group.category}`}>
                          <p className="text-base-content/60 text-xs font-medium">
                            {group.group} / {group.category}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {group.technologies.map((tech) => (
                              <span key={tech} className="badge badge-sm">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
