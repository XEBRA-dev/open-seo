import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { lookupBusinessProfiles } from "@/serverFunctions/businessProfile";
import {
  BUSINESS_PROFILE_MAX_BUSINESSES,
  parseBusinessQueries,
} from "@/types/schemas/business-profile";

type Props = {
  projectId: string;
  queries: string[];
  locationName: string;
  onSearchChange: (next: { queries: string[]; locationName: string }) => void;
};

const EM_DASH = "—";

export function BusinessProfilePage({
  projectId,
  queries,
  locationName,
  onSearchChange,
}: Props) {
  const [queriesInput, setQueriesInput] = useState(queries.join(", "));
  const [locationInput, setLocationInput] = useState(locationName);

  const queryKey = queries.join(",");
  const hasSearch = queries.length > 0;

  const profileQuery = useQuery({
    queryKey: ["business-profiles", projectId, queryKey, locationName],
    queryFn: () =>
      lookupBusinessProfiles({
        data: {
          projectId,
          queries,
          locationName: locationName || undefined,
        },
      }),
    enabled: hasSearch,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const draft = parseBusinessQueries(queriesInput);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearchChange({ queries: draft, locationName: locationInput.trim() });
  }

  const found = profileQuery.data?.rows.filter((row) => row.found) ?? [];
  const missing = profileQuery.data?.rows.filter((row) => !row.found) ?? [];

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Business profiles</h1>
          <p className="text-base-content/60 text-sm">
            Compare Google Business Profiles — rating, review volume and claim
            status. Rating and review count are two of the strongest local-pack
            ranking signals.
          </p>
        </div>

        <div className="card bg-base-100 border-base-300 border">
          <div className="card-body gap-4">
            <form className="space-y-3" onSubmit={submit}>
              <div className="flex flex-col gap-3 lg:flex-row">
                <label className="form-control flex-1">
                  <span className="label-text mb-1">
                    Businesses (up to {BUSINESS_PROFILE_MAX_BUSINESSES}, comma
                    separated)
                  </span>
                  <input
                    className="input input-bordered w-full"
                    value={queriesInput}
                    onChange={(event) => setQueriesInput(event.target.value)}
                    placeholder="Inovela, Svea Solar"
                  />
                </label>
                <label className="form-control flex-1">
                  <span className="label-text mb-1">Location (optional)</span>
                  <input
                    className="input input-bordered w-full"
                    value={locationInput}
                    onChange={(event) => setLocationInput(event.target.value)}
                    placeholder="Stockholm,Sweden"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary shrink-0 px-6"
                  disabled={draft.length === 0}
                >
                  {profileQuery.isFetching ? "Looking up..." : "Compare"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {profileQuery.isError && (
          <div className="alert alert-error">
            <span>{getStandardErrorMessage(profileQuery.error)}</span>
          </div>
        )}

        {missing.length > 0 && (
          <div className="alert alert-warning py-2">
            <span className="text-sm">
              No profile found for {missing.map((r) => r.query).join(", ")}. Try
              the exact business name, or add a location to disambiguate.
            </span>
          </div>
        )}

        {profileQuery.data && profileQuery.data.failedQueries.length > 0 && (
          <div className="alert alert-warning py-2">
            <span className="text-sm">
              Could not fetch {profileQuery.data.failedQueries.join(", ")}.
            </span>
          </div>
        )}

        {!hasSearch && (
          <div className="border-base-300 text-base-content/55 flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm">
            <Star className="size-6" />
            <p>
              Enter a client and its local competitors to compare their Google
              profiles.
            </p>
          </div>
        )}

        {hasSearch && profileQuery.isPending && (
          <div className="flex justify-center p-10">
            <span className="loading loading-spinner" />
          </div>
        )}

        {found.length > 0 && (
          <div className="card bg-base-100 border-base-300 border">
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th className="text-right">Rating</th>
                    <th className="text-right">Reviews</th>
                    <th className="text-center">Claimed</th>
                    <th>Category</th>
                    <th>Website</th>
                  </tr>
                </thead>
                <tbody>
                  {found.map((row) => (
                    <tr key={row.query}>
                      <td>
                        <div>{row.title ?? row.query}</div>
                        {row.address && (
                          <div className="text-base-content/50 text-xs">
                            {row.address}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        {row.rating == null ? EM_DASH : row.rating.toFixed(1)}
                      </td>
                      <td className="text-right">
                        {row.reviewCount ?? EM_DASH}
                      </td>
                      <td className="text-center">
                        {row.isClaimed == null ? (
                          EM_DASH
                        ) : row.isClaimed ? (
                          <span className="text-success">●</span>
                        ) : (
                          <span className="text-warning">no</span>
                        )}
                      </td>
                      <td>{row.category ?? EM_DASH}</td>
                      <td>{row.domain ?? EM_DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-base-300 text-base-content/55 border-t px-4 py-3 text-xs">
              Ordered by rating, then review volume. An unclaimed profile is an
              easy win — it means nobody is managing the listing. This shows
              profile metrics, not review text: DataForSEO&rsquo;s review
              endpoints are task-based and cannot be fetched synchronously.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
