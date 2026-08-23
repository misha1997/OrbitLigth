// Satellites page (satellites.html): multi-group live map with a chip bar that
// toggles Celestrak groups on/off. Port of the satellites.html inline script.
// Default-on groups (starlink/visual/stations) load on first paint; chips come
// from /api/tle/groups and add/remove groups through the SatMap ref handle.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import SatMap from "../components/SatMap";
import SatMapFullscreen from "../components/SatMapFullscreen";
import LocalizedLink from "../components/primitives/LocalizedLink";
import SectionHead from "../components/primitives/SectionHead";
import { useApi } from "../hooks/useApi";
import { getTleGroups, getDebris } from "../lib/api";
import { fmtInt } from "../lib/format";
import ReentryList from "../components/deep/ReentryList";

const DEFAULTS = ["starlink", "visual", "stations"];

function DebrisCard({ label, value, unit }) {
  return (
    <div className="card">
      <div className="k">{label}</div>
      <div className="v" style={{ fontSize: 26 }}>{value}{unit && <span className="unit">{unit}</span>}</div>
    </div>
  );
}

function Debris({ t }) {
  const { data } = useApi(getDebris);
  const d = data || {};
  const na = "—";
  return (
    <>
      <div className="grid cols-4" id="debris-stats">
        <DebrisCard label={t("deep.debris.tracked")} value={d.tracked != null ? fmtInt(d.tracked) : na} />
        <DebrisCard label={t("deep.debris.cm1")} value={d.cm1 != null ? fmtInt(d.cm1) : na} />
        <DebrisCard label={t("deep.debris.cm01")} value={d.cm01 != null ? fmtInt(d.cm01) : na} />
        <DebrisCard label={t("deep.debris.mass")} value={d.total_mass_t != null ? fmtInt(d.total_mass_t) : na} unit={t("deep.debris.tons")} />
      </div>
      <div className="grid cols-3" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="k">{t("deep.debris.breakups")}</div>
          <div className="v accent" style={{ fontSize: 26, marginTop: 8 }}>
            <span id="debris-breakups">{d.breakups != null ? d.breakups : "—"}</span>
          </div>
          <div className="foot">{t("deep.debris.breakupsFoot")}</div>
        </div>
        <div className="card">
          <div className="k">{t("deep.debris.why")}</div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 10, lineHeight: 1.55 }}>{t("deep.debris.whyBody")}</p>
        </div>
        <div className="card">
          <div className="k">{t("deep.debris.data")}</div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 10, lineHeight: 1.55 }}>{t("deep.debris.dataBody", { year: d.year_ref || "—" })}</p>
          <a id="debris-source" href={d.source_url || "#"} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--teal)", display: "inline-block", marginTop: 10 }}>{t("deep.debris.source")}</a>
        </div>
      </div>
    </>
  );
}

export default function Satellites() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.satellites"); }, [t]);
  const { lang } = useLang();
  const mapRef = useRef(null);
  const { data: groups } = useApi(() => getTleGroups(lang), { deps: [lang] });
  const [active, setActive] = useState(() =>
    DEFAULTS.reduce((a, k) => { a[k] = true; return a; }, {})
  );
  const [count, setCount] = useState(null);
  const [showFs, setShowFs] = useState(false);

  const toggle = (g) => {
    const map = mapRef.current;
    if (!map) return;
    if (active[g.key]) {
      map.removeGroup(g.key);
      setActive((a) => ({ ...a, [g.key]: false }));
    } else {
      setActive((a) => ({ ...a, [g.key]: true }));
      map.addGroup(g.key).then(() => setCount(map.sats.length));
    }
    setCount(map.sats.length);
  };

  const countTxt = count == null ? t("satellites.loading") : t("satellites.onMap", { n: count });

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("satellites.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("satellites.hero.title") }} />
            <p className="hero-sub">{t("satellites.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#sat-map-card" className="btn primary">{t("satellites.hero.map")}</a>
              <LocalizedLink to="iss" className="btn ghost">{t("satellites.hero.iss")}</LocalizedLink>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="sat-map-card" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className={`map-card ${showFs ? 'sat-map-fs' : ''}`}>
            <div className="sat-controls">
              {(groups || []).map((g) => (
                <button type="button" key={g.key}
                  className={"chip" + (active[g.key] ? " on" : "")}
                  style={{ color: active[g.key] ? g.color : "" }}
                  onClick={() => toggle(g)}>
                  <span className="swatch" style={{ background: g.color }} />
                  {g.icon ? g.icon + " " : ""}{g.label}
                </button>
              ))}
              <span className="count">{countTxt}</span>
            </div>
            <div className="map-body map-live" style={{ position: 'relative' }}>
              <button
                type="button"
                className="const-fs-cta"
                onClick={() => setShowFs(true)}
                aria-label={t("jupiter.system.fullscreen")}
                title={t("jupiter.system.fullscreenHint", { count: count || 0 })}
                style={{ position: 'absolute', top: 12, right: 12, left: 'auto', zIndex: 1000 }}
              >
                <span className="const-fs-cta-ico">⛶</span>
                <span className="const-fs-cta-tip" style={{ left: 'auto', right: 0, textAlign: 'right' }}>
                  {t("jupiter.system.fullscreenHint", { count: count || 0 })}
                </span>
              </button>
              <SatMap ref={mapRef} groups={DEFAULTS} limit={400} lang={lang}
                onReady={(n) => setCount(n)}
                onCount={(n) => setCount(n)} />
            </div>
          </div>
          <p className="section-sub" style={{ marginTop: 14 }}>{t("satellites.s1_sub")}</p>
        </div>
      </section>

      {showFs && (
        <SatMapFullscreen 
          active={active} 
          groups={groups} 
          toggle={toggle} 
          count={count} 
          lang={lang} 
          onClose={() => setShowFs(false)} 
        />
      )}

      <section className="section" id="debris" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("deep.s1.eyebrow")} title={t("deep.s1.title")}
            linkHref="https://www.esa.int/Space_Safety/Space_Debris" linkLabel={t("deep.s1.link")} />
          <p className="section-sub">{t("deep.s1.sub")}</p>
          <Debris t={t} />
        </div>
      </section>

      <section className="section" id="reentries" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("deep.reentries.eyebrow")} title={t("deep.reentries.title")}
            linkHref="https://celestrak.org/satcat/" linkLabel={t("deep.reentries.link_out")} />
          <p className="section-sub">{t("deep.reentries.sub")}</p>
          <ReentryList />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("satellites.s2.eyebrow")} title={t("satellites.s2.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("satellites.cards.tle")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{t("satellites.cards.tleBody")}</p>
            </div>
            <div className="card">
              <div className="k">{t("satellites.cards.sgp4")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{t("satellites.cards.sgp4Body")}</p>
            </div>
            <div className="card">
              <div className="k">{t("satellites.cards.realtime")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{t("satellites.cards.realtimeBody")}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}