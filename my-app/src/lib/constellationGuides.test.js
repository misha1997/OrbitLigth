import { constellationGuides, constellationGuidePath } from "./constellationGuides";
import { nameFromPath, switchLangPath } from "./seo";

test("all field guides resolve and preserve the guide when switching languages", () => {
  for (const guide of constellationGuides) {
    for (const lang of ["uk", "en"]) {
      const path = constellationGuidePath(guide.slug, lang);
      expect(nameFromPath(path)).toEqual({ name: "constellations", lang, constellationSlug: guide.slug });
      const other = lang === "uk" ? "en" : "uk";
      expect(switchLangPath(path, other)).toBe(constellationGuidePath(guide.slug, other));
    }
  }
});

test.each(["/en/constellations/unknown", "/ua/suzirya/orion/extra", "/en/constellations/Orion"])("%s is a missing page", path => {
  expect(nameFromPath(path).name).toBe("404");
});
