type PaidGapTableRow = {
  keyword: string;
  bidders: string[];
  clientBids: boolean;
  searchVolume: number | null;
  cpc: number | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  competition: number | null;
  competitionLevel: string | null;
};

type Props = {
  rows: PaidGapTableRow[];
  clientDomain: string;
  competitors: string[];
};

const EM_DASH = "—";

function money(value: number | null): string {
  return value == null ? EM_DASH : `$${value.toFixed(2)}`;
}

function bidRange(row: PaidGapTableRow): string {
  if (row.lowTopOfPageBid == null && row.highTopOfPageBid == null) {
    return EM_DASH;
  }
  return `${money(row.lowTopOfPageBid)} – ${money(row.highTopOfPageBid)}`;
}

/** `competition` is a 0-1 ratio; show it as the familiar 0-100 index. */
function competitionCell(row: PaidGapTableRow): string {
  const index =
    row.competition == null ? null : Math.round(row.competition * 100);
  if (row.competitionLevel && index != null) {
    return `${row.competitionLevel} ${index}`;
  }
  return row.competitionLevel ?? (index == null ? EM_DASH : String(index));
}

export function PaidGapTable({ rows, clientDomain, competitors }: Props) {
  if (rows.length === 0) {
    return (
      <div className="border-base-300 text-base-content/55 rounded-xl border border-dashed p-10 text-center text-sm">
        No paid keywords found for these domains in this market.
      </div>
    );
  }

  const domains = [clientDomain, ...competitors];

  return (
    <div className="card bg-base-100 border-base-300 border">
      <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Keyword</th>
              {domains.map((domain) => (
                <th key={domain} className="text-center whitespace-nowrap">
                  {domain === clientDomain ? `${domain} (client)` : domain}
                </th>
              ))}
              <th className="text-right whitespace-nowrap">Bid range</th>
              <th className="text-right">CPC</th>
              <th>Competition</th>
              <th className="text-right">Volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.keyword}>
                <td>{row.keyword}</td>
                {domains.map((domain) => (
                  <td key={domain} className="text-center">
                    {row.bidders.includes(domain) ? (
                      <span className="text-success">●</span>
                    ) : (
                      <span className="text-base-content/30">{EM_DASH}</span>
                    )}
                  </td>
                ))}
                <td className="text-right whitespace-nowrap">
                  {bidRange(row)}
                </td>
                <td className="text-right">{money(row.cpc)}</td>
                <td>{competitionCell(row)}</td>
                <td className="text-right">{row.searchVolume ?? EM_DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
