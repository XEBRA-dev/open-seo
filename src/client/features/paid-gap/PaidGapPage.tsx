import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Coins } from "lucide-react";

import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { useProjectMarket } from "@/client/features/projects/useProjectMarket";
import { analysePaidGap } from "@/serverFunctions/paidGap";
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
  // Raw comma-separated text; parsed into a deduped list on submit.
  const [competitorsInput, setCompetitorsInput] = useState(
    competitors.join(", "),
  );

  const market = useProjectMarket(projectId);
  const trimmedClient = clientDomain.trim();
  const hasSearch = trimmedClient.length > 0;
  // Stable key: `competitors` is a fresh array every render.
  const competitorKey = competitors.join(",");

  const gapQuery = useQuery({
    queryKey: ["paid-gap", projectId, trimmedClient, competitorKey],
    queryFn: () =>
      analysePaidGap({
        data: {
          clientDomain: trimmedClient,
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearchChange({
      client: clientInput.trim(),
      competitors: parseCompetitorDomains(competitorsInput),
      gapOnly,
    });
  }

  const rows = gapQuery.data?.rows ?? [];
  const visibleRows = gapOnly
    ? rows.filter((row) => !row.clientBids && row.bidders.length > 0)
    : rows;

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Paid gap</h1>
          <p className="text-muted-foreground text-sm">
            Compare which keywords a client and its competitors buy Google Ads
            on, and what each one costs. All amounts in USD.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card space-y-3 rounded-lg border p-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Client domain</span>
              <input
                value={clientInput}
                onChange={(event) => setClientInput(event.target.value)}
                placeholder="inovela.se"
                className="bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">
                Competitors (up to {PAID_GAP_MAX_COMPETITORS}, comma separated)
              </span>
              <input
                value={competitorsInput}
                onChange={(event) => setCompetitorsInput(event.target.value)}
                placeholder="rival-one.se, rival-two.se"
                className="bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={gapOnly}
                onChange={(event) =>
                  onSearchChange({
                    client: clientDomain,
                    competitors,
                    gapOnly: event.target.checked,
                  })
                }
              />
              <span>Gap only (competitors bid, client does not)</span>
            </label>
            <button
              type="submit"
              disabled={!clientInput.trim()}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Analyse
            </button>
          </div>
        </form>

        {gapQuery.isError && (
          <div className="text-destructive flex items-start gap-2 rounded-lg border p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{getStandardErrorMessage(gapQuery.error)}</span>
          </div>
        )}

        {gapQuery.data && (
          <div className="text-muted-foreground space-y-1 text-sm">
            {gapQuery.data.truncated && (
              <p>
                Found {gapQuery.data.keywordCount} keywords; the first 700 are
                priced.
              </p>
            )}
            {gapQuery.data.failedDomains.length > 0 && (
              <p>
                Could not fetch: {gapQuery.data.failedDomains.join(", ")}.
                Remaining domains are shown.
              </p>
            )}
          </div>
        )}

        {!hasSearch && (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm">
            <Coins className="h-6 w-6" />
            <p>
              Enter a client domain and up to {PAID_GAP_MAX_COMPETITORS}{" "}
              competitors to see who bids on what.
            </p>
          </div>
        )}

        {hasSearch && gapQuery.isPending && (
          <p className="text-muted-foreground text-sm">Analysing…</p>
        )}

        {gapQuery.isSuccess && (
          <PaidGapTable
            rows={visibleRows}
            clientDomain={trimmedClient}
            competitors={competitors}
          />
        )}
      </div>
    </div>
  );
}
