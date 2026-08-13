import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";

import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { analyseBacklinkGap } from "@/serverFunctions/backlinkGap";
import { normalizeDomain } from "@/shared/normalizeDomain";
import {
  BACKLINK_GAP_MAX_COMPETITORS,
  parseBacklinkCompetitors,
} from "@/types/schemas/backlink-gap";

import { BacklinkGapTable } from "./BacklinkGapTable";

type Props = {
  projectId: string;
  clientDomain: string;
  competitors: string[];
  gapOnly: boolean;
  withSpam: boolean;
  onSearchChange: (next: {
    client: string;
    competitors: string[];
    gapOnly: boolean;
    withSpam: boolean;
  }) => void;
};

export function BacklinkGapPage({
  projectId,
  clientDomain,
  competitors,
  gapOnly,
  withSpam,
  onSearchChange,
}: Props) {
  const [clientInput, setClientInput] = useState(clientDomain);
  const [competitorsInput, setCompetitorsInput] = useState(
    competitors.join(", "),
  );

  // Normalize again here so a hand-edited URL cannot send a full URL upstream.
  const client = normalizeDomain(clientDomain);
  const hasSearch = client.length > 0 && competitors.length > 0;
  const competitorKey = competitors.join(",");

  const gapQuery = useQuery({
    queryKey: ["backlink-gap", projectId, client, competitorKey, withSpam],
    queryFn: () =>
      analyseBacklinkGap({
        data: {
          projectId,
          clientDomain: client,
          competitorDomains: competitors,
          hideSpam: !withSpam,
        },
      }),
    enabled: hasSearch,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const draftCompetitors = parseBacklinkCompetitors(competitorsInput);
  const canAnalyse =
    normalizeDomain(clientInput).length > 0 && draftCompetitors.length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearchChange({
      client: normalizeDomain(clientInput),
      competitors: draftCompetitors,
      gapOnly,
      withSpam,
    });
  }

  const rows = gapQuery.data?.rows ?? [];
  const visibleRows = gapOnly
    ? rows.filter((row) => !row.linksToClient && row.linksTo.length > 0)
    : rows;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Backlink gap</h1>
          <p className="text-base-content/60 text-sm">
            Domains that link to a client&rsquo;s competitors but not to the
            client — the link-building shortlist.
          </p>
        </div>

        <div className="card bg-base-100 border-base-300 border">
          <div className="card-body gap-4">
            <form className="space-y-3" onSubmit={submit}>
              <div className="flex flex-col gap-3 lg:flex-row">
                <label className="form-control flex-1">
                  <span className="label-text mb-1">Client domain</span>
                  <input
                    className="input input-bordered w-full"
                    value={clientInput}
                    onChange={(event) => setClientInput(event.target.value)}
                    placeholder="inovela.se"
                  />
                </label>
                <label className="form-control flex-1">
                  <span className="label-text mb-1">
                    Competitors (up to {BACKLINK_GAP_MAX_COMPETITORS}, comma
                    separated)
                  </span>
                  <input
                    className="input input-bordered w-full"
                    value={competitorsInput}
                    onChange={(event) =>
                      setCompetitorsInput(event.target.value)
                    }
                    placeholder="sveasolar.se, rival.se"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={gapOnly}
                      onChange={(event) =>
                        onSearchChange({
                          client,
                          competitors,
                          gapOnly: event.target.checked,
                          withSpam,
                        })
                      }
                    />
                    <span>
                      Gap only (links to a competitor, not the client)
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={withSpam}
                      onChange={(event) =>
                        onSearchChange({
                          client,
                          competitors,
                          gapOnly,
                          withSpam: event.target.checked,
                        })
                      }
                    />
                    <span>Include spammy domains</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary shrink-0 px-6"
                  title={
                    canAnalyse
                      ? undefined
                      : "Enter a client domain and at least one competitor"
                  }
                  disabled={!canAnalyse}
                >
                  {gapQuery.isFetching ? "Analysing..." : "Analyse"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {gapQuery.isError && (
          <div className="alert alert-error">
            <span>{getStandardErrorMessage(gapQuery.error)}</span>
          </div>
        )}

        {gapQuery.data && gapQuery.data.truncatedDomains.length > 0 && (
          <div className="alert alert-warning py-2">
            <span className="text-sm">
              Only the top 200 referring domains were fetched for{" "}
              {gapQuery.data.truncatedDomains.join(", ")}, so the list is
              partial.
            </span>
          </div>
        )}

        {gapQuery.data && gapQuery.data.failedDomains.length > 0 && (
          <div className="alert alert-warning py-2">
            <span className="text-sm">
              Could not fetch {gapQuery.data.failedDomains.join(", ")}. The
              remaining domains are shown.
            </span>
          </div>
        )}

        {!hasSearch && (
          <div className="border-base-300 text-base-content/55 flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm">
            <Link2 className="size-6" />
            <p>
              Enter a client domain and at least one competitor (up to{" "}
              {BACKLINK_GAP_MAX_COMPETITORS}) to see who links to them.
            </p>
          </div>
        )}

        {hasSearch && gapQuery.isPending && (
          <div className="flex justify-center p-10">
            <span className="loading loading-spinner" />
          </div>
        )}

        {gapQuery.isSuccess && (
          <BacklinkGapTable
            rows={visibleRows}
            clientDomain={client}
            competitors={competitors}
          />
        )}
      </div>
    </div>
  );
}
