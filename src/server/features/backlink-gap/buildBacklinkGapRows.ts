import type { ReferringDomainItem } from "@/server/lib/dataforseo/backlinks";

export type BacklinkGapRow = {
  /** The domain doing the linking. */
  referringDomain: string;
  /** Analysed domains this one links to, the client included. */
  linksTo: string[];
  linksToClient: boolean;
  backlinks: number | null;
  referringPages: number | null;
  /** DataForSEO domain rank, its authority proxy. */
  rank: number | null;
  spamScore: number | null;
  firstSeen: string | null;
};

// DataForSEO echoes domains with inconsistent casing, so every lookup folds.
function fold(domain: string): string {
  return domain.trim().toLowerCase();
}

/**
 * Union each analysed domain's referring domains into one row per referring
 * domain, ordered so the best link-building prospects surface first: linked to
 * the most competitors, then highest authority.
 *
 * Pure — all network work happens in the caller.
 */
export function buildBacklinkGapRows(input: {
  clientDomain: string;
  referringDomainsByTarget: Map<string, ReferringDomainItem[]>;
}): BacklinkGapRow[] {
  const client = fold(input.clientDomain);
  const display = new Map<string, string>();
  const linksTo = new Map<string, Set<string>>();
  // Metrics describe the referring domain itself, so the first row carrying a
  // value wins; later targets repeat the same figures.
  const metrics = new Map<string, ReferringDomainItem>();

  for (const [target, items] of input.referringDomainsByTarget) {
    for (const item of items) {
      const raw = item.domain ?? "";
      const key = fold(raw);
      if (!key) continue;
      if (!display.has(key)) display.set(key, raw);
      if (!metrics.has(key)) metrics.set(key, item);
      const targets = linksTo.get(key) ?? new Set<string>();
      targets.add(target);
      linksTo.set(key, targets);
    }
  }

  const rows: BacklinkGapRow[] = [];
  for (const [key, targets] of linksTo) {
    const m = metrics.get(key);
    rows.push({
      referringDomain: display.get(key) ?? key,
      linksTo: [...targets],
      linksToClient: [...targets].some((target) => fold(target) === client),
      backlinks: m?.backlinks ?? null,
      referringPages: m?.referring_pages ?? null,
      rank: m?.rank ?? null,
      spamScore: m?.backlinks_spam_score ?? null,
      firstSeen: m?.first_seen ?? null,
    });
  }

  const competitorCount = (row: BacklinkGapRow) =>
    row.linksTo.filter((target) => fold(target) !== client).length;

  return rows.toSorted(
    (a, b) =>
      competitorCount(b) - competitorCount(a) ||
      (b.rank ?? 0) - (a.rank ?? 0) ||
      a.referringDomain.localeCompare(b.referringDomain),
  );
}
