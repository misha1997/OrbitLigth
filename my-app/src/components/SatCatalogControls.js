import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OBJECT_COLORS } from "../lib/orbitalCatalog";
import OrbitalCategory from "./OrbitalCategory";

export function CatalogStatus({ catalog }) {
  const { t } = useTranslation();
  return <div className="sat-catalog-status" role="status" aria-live="polite">
    <span className="sat-live-dot" /><span>{t("orbital.displayed", { count: catalog.frame?.valid || 0 })}</span>
    {catalog.loading && <span>{t("orbital.loading")}</span>}
    {(catalog.failed.length > 0 || catalog.groupError) && <>
      <span className="sat-warning">{t("orbital.partial", { count: catalog.failed.length })}</span>
      <button type="button" onClick={catalog.retry}>{t("orbital.retry")}</button>
    </>}
    {catalog.workerError && <span className="sat-warning">{t("orbital.workerError")}</span>}
  </div>;
}
export default function SatCatalogControls({ catalog, compact = false }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(!compact);
  const { groups, active, toggle, selectAll, status } = catalog;
  const popular = ["stations", "visual", "science", "weather", "gnss", "starlink"];
  const filtered = groups.filter(g => (!compact || expanded || popular.includes(g.key)) && g.label.toLowerCase().includes(search.toLowerCase()));
  return <div className={`sat-catalog-controls ${compact ? "is-compact" : ""}`}>
    <div className="sat-type-filters">{Object.entries(OBJECT_COLORS).map(([key, color]) => <OrbitalCategory key={key}
      label={t(`orbital.types.${key}`)} description={t(`orbital.typeDescriptions.${key}`)} color={color}
      checked={catalog.types[key]} onChange={() => catalog.toggleType(key)} />)}</div>
    <div className="sat-filter-heading"><strong>{t("orbital.layers")}</strong>
      <span className="sat-filter-actions"><button type="button" onClick={catalog.recommended}>{t("orbital.recommended")}</button>
        <button type="button" onClick={() => selectAll(true)}>{t("orbital.all")}</button>
        <button type="button" onClick={() => selectAll(false)}>{t("orbital.none")}</button></span></div>
    {compact && <p className="sat-filter-intro">{t("orbital.defaultHint")}</p>}
    {expanded && <input type="search" className="sat-search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("orbital.searchGroups")} aria-label={t("orbital.searchGroups")} />}
    <div className="sat-filter-list">
      {filtered.map(g => <OrbitalCategory key={g.key} label={g.label} color={OBJECT_COLORS[g.category]}
        description={t(`orbital.groupDescriptions.${g.key}`, { defaultValue: t(`orbital.typeDescriptions.${g.category}`) })}
        checked={!!active[g.key]} onChange={() => toggle(g.key)}>
        {active[g.key] && status[g.key] === "loading" && <small>…</small>}
        {active[g.key] && ["error", "stale"].includes(status[g.key]) && <small className="sat-warning" title={t(`orbital.${status[g.key]}`)}>!</small>}
      </OrbitalCategory>)}
    </div>
    {compact && <button type="button" className="sat-more-layers" onClick={() => setExpanded(v => !v)}>{t(expanded ? "orbital.lessGroups" : "orbital.moreGroups", { count: groups.length })} {expanded ? "−" : "+"}</button>}
    {!filtered.length && !catalog.loading && <p>{t("orbital.noResults")}</p>}
  </div>;
}
