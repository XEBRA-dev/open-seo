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

/** competition is a 0-1 ratio; show the 0-100 index alongside the level. */
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
      <p className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        No paid keywords found for these domains in this market.
      </p>
    );
  }

  const domains = [clientDomain, ...competitors];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Keyword</th>
            {domains.map((domain) => (
              <th
                key={domain}
                className="px-3 py-2 text-center font-medium whitespace-nowrap"
              >
                {domain === clientDomain ? `${domain} (client)` : domain}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
              Bid range (USD)
            </th>
            <th className="px-3 py-2 text-right font-medium">CPC</th>
            <th className="px-3 py-2 font-medium">Competition</th>
            <th className="px-3 py-2 text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.keyword} className="border-t">
              <td className="px-3 py-2">{row.keyword}</td>
              {domains.map((domain) => (
                <td key={domain} className="px-3 py-2 text-center">
                  {row.bidders.includes(domain) ? "●" : EM_DASH}
                </td>
              ))}
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {bidRange(row)}
              </td>
              <td className="px-3 py-2 text-right">{money(row.cpc)}</td>
              <td className="px-3 py-2">{competitionCell(row)}</td>
              <td className="px-3 py-2 text-right">
                {row.searchVolume ?? EM_DASH}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
