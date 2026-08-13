import { describe, expect, it } from "vitest";

import { flattenTechnologies } from "./flattenTechnologies";

describe("flattenTechnologies", () => {
  it("flattens the nested group/category map and humanizes keys", () => {
    const { groups, allTechnologies } = flattenTechnologies({
      content_management_system: { cms: ["WordPress", "Elementor"] },
      web_development: { javascript_frameworks: ["React"] },
    });

    expect(groups).toEqual([
      {
        group: "Content Management System",
        category: "Cms",
        technologies: ["Elementor", "WordPress"],
      },
      {
        group: "Web Development",
        category: "Javascript Frameworks",
        technologies: ["React"],
      },
    ]);
    expect(allTechnologies).toEqual(["Elementor", "React", "WordPress"]);
  });

  it("skips shapes it does not understand rather than throwing", () => {
    const { groups } = flattenTechnologies({
      good: { cms: ["WordPress"] },
      notAnObject: "nope",
      emptyCategory: { cms: [] },
      wrongItemTypes: { cms: [1, null] },
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].technologies).toEqual(["WordPress"]);
  });

  it("handles null and undefined", () => {
    expect(flattenTechnologies(null).groups).toEqual([]);
    expect(flattenTechnologies(undefined).allTechnologies).toEqual([]);
  });
});
