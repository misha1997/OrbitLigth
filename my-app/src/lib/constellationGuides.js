import index from "../data/constellationGuideIndex.json";
import { pathFor } from "./seo";

export const constellationGuides = index.items;
export const guideUi = index.ui;
export const guideChecked = index.checked;
export const getConstellationGuide = slug => constellationGuides.find(item => item.slug === slug) || null;
export const constellationGuidePath = (slug, lang) => `${pathFor("constellations", lang)}/${slug}`;

export function getConstellationBootstrap() {
  try {
    const value = JSON.parse(document.getElementById("constellation-bootstrap")?.textContent || "null");
    return value?.path === window.location.pathname ? value : null;
  } catch {
    return null;
  }
}
