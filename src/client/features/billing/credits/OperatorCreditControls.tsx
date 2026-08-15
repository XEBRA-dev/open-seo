import { useState, type FormEvent } from "react";

import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { grantCredits, setBillingPolicy } from "@/serverFunctions/credits";

type Props = {
  /** Defaults to the operator's own organization, the common case for funding
   *  XEBRA's own workspace. */
  defaultOrganizationId?: string;
  onChanged: () => void;
};

/**
 * Operator-only controls for wiring credits in by hand and setting an
 * organization's billing policy.
 *
 * The server re-checks operator status on every call — this only decides
 * whether to render, never whether the action is allowed.
 */
export function OperatorCreditControls({
  defaultOrganizationId,
  onChanged,
}: Props) {
  const [organizationId, setOrganizationId] = useState(
    defaultOrganizationId ?? "",
  );
  const [credits, setCredits] = useState("50000");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"metered" | "unlimited">("metered");
  const [markupBps, setMarkupBps] = useState("12500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      onChanged();
    } catch (caught) {
      setError(getStandardErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function submitGrant(event: FormEvent) {
    event.preventDefault();
    const amount = Number(credits);
    if (!Number.isInteger(amount) || amount === 0) {
      setError("Credits must be a non-zero whole number.");
      return;
    }
    void run(async () => {
      const { balance } = await grantCredits({
        data: {
          organizationId: organizationId.trim(),
          credits: amount,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      });
      return `Granted. New balance: ${balance.toLocaleString("en-US")} credits.`;
    });
  }

  function submitPolicy(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await setBillingPolicy({
        data: {
          organizationId: organizationId.trim(),
          mode,
          markupBps: Number(markupBps),
        },
      });
      return `Policy set to ${mode} at ${(Number(markupBps) / 10000).toFixed(2)}x.`;
    });
  }

  const hasOrg = organizationId.trim().length > 0;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-base-content/50">
        Operator controls
      </h2>

      <div className="card border border-base-300 bg-base-100">
        <div className="card-body gap-4">
          <label className="form-control">
            <span className="label-text mb-1">Organization ID</span>
            <input
              className="input input-bordered w-full font-mono text-sm"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              placeholder="org id"
            />
          </label>

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={submitGrant}
          >
            <label className="form-control">
              <span className="label-text mb-1">Credits (1000 = $1)</span>
              <input
                className="input input-bordered w-40"
                value={credits}
                onChange={(event) => setCredits(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="form-control flex-1">
              <span className="label-text mb-1">Note</span>
              <input
                className="input input-bordered w-full"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Invoice 2026-014"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !hasOrg}
            >
              Grant
            </button>
          </form>

          <form
            className="flex flex-wrap items-end gap-3 border-t border-base-300 pt-4"
            onSubmit={submitPolicy}
          >
            <label className="form-control">
              <span className="label-text mb-1">Mode</span>
              <select
                className="select select-bordered w-40"
                value={mode}
                onChange={(event) =>
                  setMode(
                    event.target.value === "metered" ? "metered" : "unlimited",
                  )
                }
              >
                <option value="metered">metered</option>
                <option value="unlimited">unlimited</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Markup (bps)</span>
              <input
                className="input input-bordered w-40"
                value={markupBps}
                onChange={(event) => setMarkupBps(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <button type="submit" className="btn" disabled={busy || !hasOrg}>
              Set policy
            </button>
            <p className="basis-full text-xs text-base-content/50">
              12500 = 1.25x (customers), 10000 = at cost (XEBRA). Values below
              10000 are rejected server-side so usage cannot be sold below cost.
            </p>
          </form>

          {error ? (
            <div className="alert alert-error py-2">
              <span className="text-sm">{error}</span>
            </div>
          ) : null}
          {notice ? (
            <div className="alert alert-success py-2">
              <span className="text-sm">{notice}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
