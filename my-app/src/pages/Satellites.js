// Shared uncapped OMM catalog for the live map and 3D Earth explorer.
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import SatCatalogMap from "../components/SatCatalogMap";
import SatCatalogControls, { CatalogStatus } from "../components/SatCatalogControls";
import useOrbitalCatalog from "../hooks/useOrbitalCatalog";
import { panelData } from "../lib/orbitalCatalog";
import SatMapFullscreen from "../components/SatMapFullscreen";
import SatDetailPanel from "../components/SatDetailPanel";
import LocalizedLink from "../components/primitives/LocalizedLink";
import SectionHead from "../components/primitives/SectionHead";
import { useApi } from "../hooks/useApi";
import { getDebris } from "../lib/api";
import { fmtInt } from "../lib/format";
import ReentryList from "../components/deep/ReentryList";

import "../styles/satellites.css";
const SatelliteGlobe = lazy(() => import("../components/SatelliteGlobe"));

function DebrisCard({ label, value, unit, note }) {
  return (
    <div className="card">
      <div className="k">{label}</div>
      <div className="v">{value}{unit && <span className="unit">{unit}</span>}</div>
      <p className="sat-stat-note">{note}</p>
    </div>
  );
}

function Debris({ t }) {
  const { data, loading, error, refetch } = useApi(getDebris);
  const d = data || {};
  const na = "—";
  if (loading) return <p role="status" className="sat-section-state">{t("orbital.statsLoading")}</p>;
  if (error || !d.reference_date) return <div role="status" className="sat-section-state">
    <span>{t("orbital.statsError")}</span> <button type="button" className="btn ghost" onClick={refetch}>{t("orbital.retry")}</button>
  </div>;
  const n = (v, prefix = "≈ ") => v != null ? prefix + fmtInt(v) : na;
  return (
    <>
      <div className="sat-stats-grid" id="debris-stats">
        <DebrisCard label={t("orbital.statsTracked")} value={n(d.tracked)} note={t("orbital.statsTrackedNote")} />
        <DebrisCard label={t("orbital.statsCm")} value={n(d.debris_1_to_10_cm)} note={t("orbital.statsEstimate")} />
        <DebrisCard label={t("orbital.statsMm")} value={n(d.debris_1mm_to_1cm)} note={t("orbital.statsEstimate")} />
        <DebrisCard label={t("orbital.statsMass")} value={n(d.total_mass_t, "> ")} unit={t("deep.debris.tons")} note={t("orbital.statsMassNote")} />
      </div>
      <div className="sat-stats-context">
        <p><strong id="debris-breakups">{t("orbital.statsBreakups", { count: d.breakups })}</strong> {t("orbital.statsContext")}</p>
        <p className="sat-source-note"><a id="debris-source" href={d.source_url} target="_blank" rel="noopener noreferrer">ESA ↗</a>
          <span>{t("orbital.statsDate")} <time dateTime={d.reference_date}>{d.reference_date}</time> · {t("orbital.statsModel", { date: d.model_ref })}</span></p>
      </div>
    </>
  );
}

export default function Satellites() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.satellites"); }, [t]);
  const { lang } = useLang();
  const catalog = useOrbitalCatalog(lang);
  const [fullscreenMode, setFullscreenMode] = useState(null);
  const showFs = fullscreenMode !== null;
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const object = catalog.objects.find(o => o.norad_id === selectedId);
    if (!object) { setSelected(null); setSelectedId(null); return; }
    const update = () => setSelected(panelData(object));
    update();
    const timer = setInterval(update, 2000);
    return () => clearInterval(timer);
  }, [catalog.objects, selectedId]);
  const closeSelection = () => setSelectedId(null);

  return (
    <>
      <section className="hero">
        <div className="wrap sat-hero-layout">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("orbital.heroEyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("satellites.hero.title") }} />
            <p className="hero-sub">{t("orbital.heroSub")}</p>
            <div className="hero-actions">
              <a href="#sat-map-card" className="btn primary">{t("satellites.hero.map")}</a>
              <button type="button" className="btn ghost" onClick={() => setFullscreenMode("3d")}>{t("orbital.open3d")}</button>
              <LocalizedLink to="iss" className="btn ghost">{t("satellites.hero.iss")}</LocalizedLink>
            </div>
          </div>
          <div className="sat-hero-globe">
            {!showFs && <Suspense fallback={<div className="sat-globe-fallback">{t("orbital.loading3d")}</div>}>
              <SatelliteGlobe objects={catalog.objects} frame={catalog.frame} miniature unavailable={t("orbital.webglError")} />
            </Suspense>}
            <span className="sat-hero-coordinate">EARTH / 6,378 KM</span>
            <div className="sat-hero-caption"><span>{t("orbital.heroCaption")}</span><button type="button" onClick={() => setFullscreenMode("3d")}>3D ↗</button></div>
          </div>
        </div>
      </section>

      <section className="section" id="sat-map-card" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="map-card">
            <SatCatalogControls catalog={catalog} compact />
            <div className="map-body map-live" style={{ position: 'relative' }}>
              <SatCatalogMap objects={catalog.objects} frame={catalog.frame} selectedId={selectedId}
                onSelect={setSelectedId} paused={showFs} onFullscreen={() => setFullscreenMode("2d")} on3D={() => setFullscreenMode("3d")} />
              <SatDetailPanel data={selected} onClose={closeSelection} />
            </div>
            <div className="sat-map-footer"><CatalogStatus catalog={catalog} /></div>
          </div>
          <p className="sat-map-note">{t("orbital.mapHint")} <a href="#satellite-guide">{t("orbital.aboutData")} ↓</a></p>
        </div>
      </section>

      {showFs && (
        <SatMapFullscreen
          catalog={catalog} selected={selected} selectedId={selectedId} onSelect={setSelectedId}
          onClose={() => setFullscreenMode(null)} initialMode={fullscreenMode}
        />
      )}

      <section className="section" id="debris" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("deep.s1.eyebrow")} title={t("deep.s1.title")}
            linkHref="https://www.esa.int/Space_Safety/Space_Debris" linkLabel={t("deep.s1.link")} />
          <p className="section-sub">{t("orbital.debrisSub")}</p>
          <Debris t={t} />
        </div>
      </section>

      <section className="section" id="reentries" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("deep.reentries.eyebrow")} title={t("deep.reentries.title")}
            linkHref="https://celestrak.org/satcat/" linkLabel={t("deep.reentries.link_out")} />
          <p className="section-sub">{t("orbital.reentriesSub")}</p>
          <ReentryList />
        </div>
      </section>

      <section className="section sat-guide" id="satellite-guide" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("satellites.s2.eyebrow")} title={t("satellites.s2.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("orbital.guideSelectionTitle")}</div>
              <p>{t("orbital.guideSelectionBody")}</p>
            </div>
            <div className="card">
              <div className="k">{t("orbital.guidePositionTitle")}</div>
              <p>{t("orbital.guidePositionBody")}</p>
            </div>
            <div className="card">
              <div className="k">{t("orbital.guideCoverageTitle")}</div>
              <p>{t("orbital.guideCoverageBody")} <a href="https://celestrak.org/NORAD/elements/" target="_blank" rel="noopener noreferrer">CelesTrak ↗</a></p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
