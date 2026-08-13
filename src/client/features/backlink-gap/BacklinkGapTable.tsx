type BacklinkGapTableRow = {
  referringDomain: string;
  linksTo: string[];
  linksToClient: boolean;
  backlinks: number | null;
  referringPages: number | null;
  rank: number | null;
  spamScore: number | null;
  firstSeen: string | null;
};

type Props = {
  rows: BacklinkGapTableRow[];
  clientDomain: string;
  competitors: string[];
};

const EM_DASH = "—";

function num(value: number | null): string {
  return value == null ? EM_DASH : String(value);
}

/** DataForSEO returns "2026-01-01 00:00:00 +00:00"; the date is enough. */
function day(value: string | null): string {
  return value ? (value.split(" ")[0] ?? EM_DASH) : EM_DASH;
}

export function BacklinkGapTable({ rows, clientDomain, competitors }: Props) {
  if (rows.length === 0) {
    return (
      <div className="border-base-300 text-base-content/55 space-y-1 rounded-xl border border-dashed p-10 text-center text-sm">
        <p>No referring domains found for these domains.</p>
        <p>
          Either these sites have no indexed backlinks, or the spam filter
          removed them all — try turning it off.
        </p>
      </div>
    );
  }

  const targets = [clientDomain, ...competitors];

  return (
    <div className="card bg-base-100 border-base-300 border">
      <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Referring domain</th>
              {targets.map((target) => (
                <th key={target} className="text-center whitespace-nowrap">
                  {target === clientDomain ? `${target} (client)` : target}
                </th>
              ))}
              <th className="text-right">Rank</th>
              <th className="text-right">Backlinks</th>
              <th className="text-right">Pages</th>
              <th className="text-right">Spam</th>
              <th className="whitespace-nowrap">First seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.referringDomain}>
                <td>{row.referringDomain}</td>
                {targets.map((target) => (
                  <td key={target} className="text-center">
                    {row.linksTo.includes(target) ? (
                      <span className="text-success">●</span>
                    ) : (
                      <span className="text-base-content/30">{EM_DASH}</span>
                    )}
                  </td>
                ))}
                <td className="text-right">{num(row.rank)}</td>
                <td className="text-right">{num(row.backlinks)}</td>
                <td className="text-right">{num(row.referringPages)}</td>
                <td className="text-right">{num(row.spamScore)}</td>
                <td className="whitespace-nowrap">{day(row.firstSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-base-300 text-base-content/55 space-y-1 border-t px-4 py-3 text-xs">
        <p>
          One row per domain linking to any of these sites.{" "}
          <span className="text-success">&#9679;</span> marks a link to that
          site. Rows are ordered by how many competitors a domain links to, then
          by authority — so the best prospects come first.
        </p>
        <p>
          <strong>Rank</strong> is DataForSEO&rsquo;s 0&ndash;1000 domain
          authority estimate. <strong>Backlinks</strong> and{" "}
          <strong>Pages</strong> count how many links and linking pages that
          domain has. <strong>Spam</strong> is its backlink spam score — lower
          is better. Source: DataForSEO Backlinks.
        </p>
      </div>
    </div>
  );
}
