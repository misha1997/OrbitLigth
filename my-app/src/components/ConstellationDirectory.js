import { useId, useMemo, useState } from "react";
import entries from "../data/constellationDirectoryEntries.json";
import { guideUi } from "../lib/constellationGuides";
import { filterGuideCards, normalizeGuideSearch } from "../lib/constellationGuideSearch";

export default function ConstellationDirectory({ lang }) {
  const language = lang === "en" ? "en" : "uk";
  const ui = guideUi[language];
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState("");
  const searchId = useId();
  const seasonId = useId();
  const cards = useMemo(() => entries[language].cards.map(card => ({
    ...card, searchText: normalizeGuideSearch(card.search),
  })), [language]);
  const visible = useMemo(() => filterGuideCards(cards, query, season), [cards, query, season]);
  const reset = () => { setQuery(""); setSeason(""); };
  return <>
    <link rel="stylesheet" href="/constellations/guides.css" precedence="default" />
    <section className="cg-directory" id="field-guides" aria-labelledby="cg-directory-title">
      <div dangerouslySetInnerHTML={{ __html: entries[language].heading }} />
      <form className="cg-filters" onSubmit={event => event.preventDefault()} role="search" aria-label={ui.directory}>
        <div className="cg-filter-field">
          <label htmlFor={searchId}>{ui.search}</label>
          <input id={searchId} type="search" value={query} placeholder={ui.searchPlaceholder}
            onChange={event => setQuery(event.target.value)} autoComplete="off" />
        </div>
        <div className="cg-filter-field">
          <label htmlFor={seasonId}>{ui.filterSeason}</label>
          <select id={seasonId} value={season} onChange={event => setSeason(event.target.value)}>
            {Object.entries(ui.seasons).map(([key, value]) => <option key={key} value={key === "all" ? "" : key}>{value}</option>)}
          </select>
        </div>
        <button type="button" className="btn ghost" onClick={reset} disabled={!query && !season}>{ui.reset}</button>
      </form>
      <p className="cg-filter-status" role="status" aria-live="polite" aria-atomic="true">{ui.results}: {visible.length} / {cards.length}</p>
      {visible.length === 0 && <p className="cg-note">{ui.empty}</p>}
      <div className="cg-directory-grid" dangerouslySetInnerHTML={{ __html: visible.map(card => card.html).join("") }} />
    </section>
  </>;
}
