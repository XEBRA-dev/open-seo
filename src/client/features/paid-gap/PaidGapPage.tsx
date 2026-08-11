import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

import { useProjectMarket } from "@/client/features/projects/useProjectMarket";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { analysePaidGap } from "@/serverFunctions/paidGap";
import { normalizeDomain } from "@/shared/normalizeDomain";
import {
  PAID_GAP_MAX_COMPETITORS,
  parseCompetitorDomains,
} from "@/types/schemas/paid-gap";

import { PaidGapTable } from "./PaidGapTable";

type Props = {
  projectId: string;
  clientDomain: string;
  competitors: string[];
  gapOnly: boolean;
  onSearchChange: (next: {
    client: string;
    competitors: string[];
    gapOnly: boolean;
  }) => void;
};

export function PaidGapPage({
  projectId,
  clientDomain,
  competitors,
  gapOnly,
  onSearchChange,
}: Props) {
  const [clientInput, setClientInput] = useState(clientDomain);
  // Raw comma-separated text; normalized into a deduped domain list on submit.
  const [competitorsInput, setCompetitorsInput] = useState(
    competitors.join(", "),
  );

  const market = useProjectMarket(projectId);
  // The URL params are already normalized on submit, but normalize again so a
  // hand-edited URL can't send a full URL to DataForSEO.
  const client = normalizeDomain(clientDomain);
  const hasSearch = client.length > 0;
  // Stable key: `competitors` is a fresh array on every render.
  const competitorKey = competitors.join(",");

  const gapQuery = useQuery({
    queryKey: ["paid-gap", projectId, client, competitorKey],
    queryFn: () =>
      analysePaidGap({
        data: {
          clientDomain: client,
          competitorDomains: competitors,
          locationCode: market!.locationCode,
          languageCode: market!.languageCode,
        },
      }),
    // The market comes from the projects query; without it we would silently
    // analyse the wrong country.
    enabled: hasSearch && market !== undefined,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearchChange({
      client: normalizeDomain(clientInput),
      competitors: parseCompetitorDomains(competitorsInput),
      gapOnly,
    });
  }

  const rows = gapQuery.data?.rows ?? [];
  const visibleRows = gapOnly
    ? rows.filter((row) => !row.clientBids && row.bidders.length > 0)
    : rows;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Paid gap</h1>
          <p className="text-base-content/60 text-sm">
            Compare which keywords a client and its competitors buy Google Ads
            on, and what each one costs. All amounts in USD.
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
                    Competitors (up to {PAID_GAP_MAX_COMPETITORS}, comma
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
                      })
                    }
                  />
                  <span>Gap only (competitors bid, client does not)</span>
                </label>
                <button
                  type="submit"
                  className="btn btn-primary shrink-0 px-6"
                  disabled={!normalizeDomain(clientInput)}
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

        {gapQuery.data?.truncated && (
          <div className="alert alert-warning py-2">
            <span className="text-sm">
              Found {gapQuery.data.keywordCount} keywords; the first 700 are
              priced.
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
            <Coins className="size-6" />
            <p>
              Enter a client domain and up to {PAID_GAP_MAX_COMPETITORS}{" "}
              competitors to see who bids on what.
            </p>
          </div>
        )}

        {hasSearch && gapQuery.isPending && (
          <div className="flex justify-center p-10">
            <span className="loading loading-spinner" />
          </div>
        )}

        {gapQuery.isSuccess && (
          <PaidGapTable
            rows={visibleRows}
            clientDomain={client}
            competitors={competitors}
          />
        )}
      </div>
    </div>
  );
}
