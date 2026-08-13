export type TechGroup = {
  /** Top-level grouping DataForSEO uses, e.g. "content_management_system". */
  group: string;
  /** Category within the group, e.g. "cms". */
  category: string;
  technologies: string[];
};

export type TechStackRow = {
  domain: string;
  title: string | null;
  domainRank: number | null;
  countryCode: string | null;
  lastVisited: string | null;
  groups: TechGroup[];
  /** Flat, deduped list — handy for comparing domains at a glance. */
  allTechnologies: string[];
};

// Human-readable labels from DataForSEO's snake_case group keys.
function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * DataForSEO returns `technologies` as a nested, free-form
 * group -> category -> string[] map. Flatten it into sorted rows the UI can
 * render without knowing the taxonomy, which changes over time.
 *
 * Pure — unknown shapes are skipped rather than throwing, because this is
 * vendor data we do not control.
 */
export function flattenTechnologies(
  technologies: Record<string, unknown> | null | undefined,
): { groups: TechGroup[]; allTechnologies: string[] } {
  const groups: TechGroup[] = [];
  const all = new Set<string>();

  for (const [group, categories] of Object.entries(technologies ?? {})) {
    if (!categories || typeof categories !== "object") continue;
    // The typeof guard narrows to `object`, which Object.entries accepts —
    // no assertion needed.
    for (const [category, list] of Object.entries(categories)) {
      if (!Array.isArray(list)) continue;
      const names = list.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      );
      if (names.length === 0) continue;
      names.forEach((name) => all.add(name));
      groups.push({
        group: humanize(group),
        category: humanize(category),
        technologies: names.toSorted((a, b) => a.localeCompare(b)),
      });
    }
  }

  return {
    groups: groups.toSorted(
      (a, b) =>
        a.group.localeCompare(b.group) || a.category.localeCompare(b.category),
    ),
    allTechnologies: [...all].toSorted((a, b) => a.localeCompare(b)),
  };
}
