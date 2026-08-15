import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getCreditSummary,
  startCreditCheckout,
} from "@/serverFunctions/credits";
import { CREDIT_PACKS } from "@/shared/credit-packs";
import { LOW_CREDITS_THRESHOLD, creditsToUsd } from "@/shared/credits";

import { OperatorCreditControls } from "./OperatorCreditControls";

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatCredits(value: number): string {
  return value.toLocaleString("en-US");
}

/** Ledger rows are signed; show the sign explicitly so a spend never reads as a top-up. */
function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatCredits(delta)}`;
}

export function CreditsBillingPage() {
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["credit-summary"],
    queryFn: () => getCreditSummary(),
    staleTime: 30 * 1000,
  });

  async function buy(packId: string) {
    setCheckoutError(null);
    setPendingPackId(packId);
    try {
      const { url } = await startCreditCheckout({
        data: { packId, origin: window.location.origin },
      });
      window.location.assign(url);
    } catch (error) {
      setCheckoutError(getStandardErrorMessage(error));
      setPendingPackId(null);
    }
  }

  const balance = summaryQuery.data?.balance ?? 0;
  const policy = summaryQuery.data?.policy;
  const entries = summaryQuery.data?.entries ?? [];
  const isMetered = policy?.mode === "metered";
  const isLow = isMetered && balance <= LOW_CREDITS_THRESHOLD;

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-8 pb-24 md:px-6 md:py-12 md:pb-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-base-content/60">
            Prepaid credits are spent as you run analyses. 1000 credits = $1.
          </p>
        </div>

        {summaryQuery.isPending ? (
          <div className="flex justify-center p-10">
            <span className="loading loading-spinner" />
          </div>
        ) : null}

        {summaryQuery.isError ? (
          <div className="alert alert-error">
            <span>{getStandardErrorMessage(summaryQuery.error)}</span>
          </div>
        ) : null}

        {summaryQuery.isSuccess ? (
          <>
            <div className="card border border-base-300 bg-base-100">
              <div className="card-body gap-1">
                <span className="text-sm text-base-content/50">Balance</span>
                <span className="text-3xl font-semibold">
                  {formatCredits(balance)}
                  <span className="ml-2 text-base font-normal text-base-content/60">
                    ({formatUsd(creditsToUsd(balance))})
                  </span>
                </span>
                {!isMetered ? (
                  <span className="text-sm text-base-content/60">
                    This workspace is unmetered — usage is recorded for cost
                    reporting but never blocked.
                  </span>
                ) : null}
              </div>
            </div>

            {isLow ? (
              <div className="alert alert-warning py-2">
                <span className="text-sm">
                  {balance <= 0
                    ? "You are out of credits. Analyses are paused until you top up."
                    : "Your balance is running low."}
                </span>
              </div>
            ) : null}

            {checkoutError ? (
              <div className="alert alert-error">
                <span>{checkoutError}</span>
              </div>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-base-content/50">
                Buy credits
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {CREDIT_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    className="btn h-auto flex-col gap-1 py-4"
                    disabled={pendingPackId !== null}
                    onClick={() => void buy(pack.id)}
                  >
                    <span className="text-lg font-semibold">{pack.label}</span>
                    <span className="text-xs font-normal opacity-60">
                      {formatCredits(pack.credits)} credits
                    </span>
                    {pendingPackId === pack.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-base-content/50">
                Recent activity
              </h2>
              {entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-base-300 p-10 text-center text-sm text-base-content/55">
                  <Coins className="size-6" />
                  <p>No credit activity yet.</p>
                </div>
              ) : (
                <div className="card border border-base-300 bg-base-100">
                  <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Type</th>
                          <th>Detail</th>
                          <th className="text-right">Credits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="whitespace-nowrap">
                              {entry.createdAt.slice(0, 16).replace("T", " ")}
                            </td>
                            <td>{entry.kind}</td>
                            <td className="text-base-content/60">
                              {entry.description ?? "—"}
                            </td>
                            <td
                              className={`text-right whitespace-nowrap ${
                                entry.deltaCredits > 0
                                  ? "text-success"
                                  : "text-base-content"
                              }`}
                            >
                              {formatDelta(entry.deltaCredits)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {summaryQuery.data.isOperator ? (
              <OperatorCreditControls
                onChanged={() => void summaryQuery.refetch()}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
