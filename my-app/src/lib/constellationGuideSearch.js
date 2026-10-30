// Search both languages and Latin names without requiring accents or apostrophes.
export function normalizeGuideSearch(value) {
  return String(value).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[’'ʼ`]/g, "").replace(/[-–—]/g, " ")
    .replace(/\bm\s+(\d+)/g, "m$1").trim();
}

export function filterGuideCards(cards, query, season) {
  const words = normalizeGuideSearch(query).split(/\s+/).filter(Boolean);
  return cards.filter(card => (!season || card.seasons.includes(season))
    && words.every(word => card.searchText.includes(word)));
}
