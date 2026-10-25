import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import SatCatalogMap from "./SatCatalogMap";
import SatCatalogControls, { CatalogStatus } from "./SatCatalogControls";
import SatDetailPanel from "./SatDetailPanel";
import { OBJECT_COLORS } from "../lib/orbitalCatalog";

const SatelliteGlobe = lazy(() => import("./SatelliteGlobe"));
export default function SatMapFullscreen({ catalog, selected, selectedId, onSelect, onClose, initialMode = "3d" }) {
  const { t } = useTranslation();
  const dialog = useRef(null), searchRef = useRef(null);
  const [mode, setMode] = useState(initialMode), [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(""), [grid, setGrid] = useState(true), [showOrbit, setShowOrbit] = useState(true);
  const [action, setAction] = useState(null);
  const command = type => setAction({ type, at: performance.now() });
  useEffect(() => {
    const el = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow;
    el.showModal(); document.body.style.overflow = "hidden";
    return () => { el.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  const results = useMemo(() => !search.trim() ? [] : catalog.objects.filter((o, i) =>
    Number.isFinite(catalog.frame?.geographic[i * 4]) &&
    `${o.name} ${o.norad_id} ${o.omm.OBJECT_ID || ""}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 30), [search, catalog.objects, catalog.frame]);
  const selectResult = id => { onSelect(id); setSearch(""); searchRef.current?.focus(); };
  return createPortal(<dialog ref={dialog} className="sat-explorer" aria-label={t("orbital.explorer")}
    onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className="sat-explorer-header">
      <div><div className="eyebrow">ORBITLIGHT / ORBITAL EXPLORER</div><h2>{t("orbital.explorer")}</h2></div>
      <div className="sat-mode-switch" role="group" aria-label={t("orbital.viewMode")}>
        <button type="button" aria-pressed={mode === "2d"} onClick={() => setMode("2d")}>2D</button>
        <button type="button" aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>3D</button>
      </div>
      <button type="button" className="sat-close" onClick={onClose} aria-label={t("sat.panel.close")}>✕</button>
    </header>
    <div className="sat-explorer-stage">
      <div className="sat-explorer-canvas">
        {mode === "3d" ? <Suspense fallback={<div className="sat-globe-fallback">{t("orbital.loading3d")}</div>}>
          <SatelliteGlobe objects={catalog.objects} frame={catalog.frame} selectedId={selectedId} onSelect={onSelect}
            grid={grid} showOrbit={showOrbit} action={action} unavailable={t("orbital.webglError")} />
        </Suspense> : <SatCatalogMap objects={catalog.objects} frame={catalog.frame} selectedId={selectedId} onSelect={onSelect} />}
      </div>
      <aside className={`sat-explorer-sidebar ${showFilters ? "is-open" : ""}`}>
        <SatCatalogControls catalog={catalog} />
        {mode === "3d" && <div className="sat-scene-options">
          <label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> {t("orbital.grid")}</label>
          <label><input type="checkbox" checked={showOrbit} onChange={e => setShowOrbit(e.target.checked)} /> {t("orbital.selectedOrbit")}</label>
          <p>{t("orbital.scaleNote")}</p>
        </div>}
      </aside>
      <div className="sat-object-search">
        <input ref={searchRef} type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label={t("orbital.searchObjects")} placeholder={t("orbital.searchObjects")} />
        {search.trim() && <div className="sat-search-results">
          {results.map(o => <button type="button" key={o.norad_id} onClick={() => selectResult(o.norad_id)}>
            <span style={{ color: o.color }}>{o.name}</span><small>NORAD {o.norad_id}</small></button>)}
          {!results.length && <p>{t("orbital.noResults")}</p>}
        </div>}
      </div>
      <button type="button" className="sat-mobile-filters" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}>{t("orbital.layers")} {showFilters ? "−" : "+"}</button>
      {mode === "3d" && <div className="sat-camera-tools" role="group" aria-label={t("orbital.camera")}>
        <button type="button" onClick={() => command("in")} aria-label={t("orbital.zoomIn")}>+</button>
        <button type="button" onClick={() => command("out")} aria-label={t("orbital.zoomOut")}>−</button>
        <button type="button" onClick={() => command("reset")} aria-label={t("orbital.reset")}>↺</button>
        {selected && <button type="button" onClick={() => command("focus")} aria-label={t("orbital.focus")}>◎</button>}
      </div>}
      <SatDetailPanel data={selected} onClose={() => onSelect(null)} />
      <div className="sat-explorer-hint">{t(mode === "3d" ? "orbital.hint3d" : "orbital.hint2d")}</div>
    </div>
    <footer className="sat-explorer-footer"><CatalogStatus catalog={catalog} />
      <div className="sat-legend">{Object.entries(OBJECT_COLORS).map(([key, color]) => <span key={key} title={t(`orbital.typeDescriptions.${key}`)}><i style={{ background: color }} />{t(`orbital.types.${key}`)}</span>)}</div>
    </footer>
  </dialog>, document.body);
}
