// Hubble Space Telescope page: hero with a live auto-rotating 3D preview
// (fullscreen free-orbit viewer on click), orbit/mission stats, a real-image
// gallery reused from the existing /api/mast/hubble-jwst endpoint (filtered
// to HST), instrument cards, and fun facts. Mirrors Iss.js's section
// structure and lightbox pattern (Escape/arrow-key nav + scroll lock, same
// as Galaxy.js/RoverPhotos.js).
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../styles/gallery.css"; // For .photo-modal
import "../styles/telescope3d.css"; // For .tele3d-hero-* (hero 3D preview + loading placeholder)
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import LocalizedLink from "../components/primitives/LocalizedLink";
import { useApi } from "../hooks/useApi";
import { getMastHubbleJwst } from "../lib/api";

// three.js/@react-three/fiber/drei are heavy — lazy-load so the base page
// bundle stays light (same reasoning as Iss.js's IssStationHeroPreview).
const HubbleHeroPreview = lazy(() => import("./HubbleHeroPreview"));
const HubbleFullscreen = lazy(() => import("./HubbleFullscreen"));

const INSTR_BODY_STYLE = { fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", marginTop: 8, fontWeight: 400 };
const FACT_TITLE_STYLE = { fontSize: "1.2rem", marginBottom: 8, color: "var(--accent)" };
const FACT_BODY_STYLE = { fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", fontWeight: 400, textTransform: "none" };
const SCI_VALUE_STYLE = { fontSize: 20 };
const INSTRUMENTS = ["i1", "i2", "i3", "i4", "i5"];
const FACTS = ["f1", "f2", "f3", "f4", "f5", "f6"];
const VS_ROWS = ["launch", "mirror", "location", "band", "cooling", "servicing"];
const SERVICING = ["sm1", "sm2", "sm3", "sm4"];
const SCIENCE = ["sci1", "sci2", "sci3"];
// Install year + operational status — richer than the "what it does" cards
// below; NICMOS is the one instrument that's aboard but no longer used.
const INSTR_STATUS = [
  { key: "wfc3", year: 2009, active: true },
  { key: "acs", year: 2002, active: true },
  { key: "cos", year: 2009, active: true },
  { key: "stis", year: 1997, active: true },
  { key: "nicmos", year: 1997, active: false },
];
// Curated historic milestones — deliberately separate from the live "recent
// observations" gallery below, which can't surface older landmark images.
// Gradient tiles (not real photos), matching the design reference's own
// placeholder treatment.
const ICONIC = [
  { key: "ic1", tag: "1995–2014", image: "/hubble/images/pillars.jpg" },
  { key: "ic2", tag: "1995", image: "/hubble/images/deep_field.jpg" },
  { key: "ic3", tag: "2004", image: "/hubble/images/ultra_deep_field.jpg" },
  { key: "ic4", tag: "2009", image: "/hubble/images/butterfly.jpg" },
  { key: "ic5", tag: "1999", image: "/hubble/images/abell2218.jpg" },
  { key: "ic6", tag: "1994", image: "/hubble/images/jupiter_sl9.jpg" },
];

export default function Hubble() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.hubble"); }, [t]);
  const [show3D, setShow3D] = useState(false);
  const [modalIdx, setModalIdx] = useState(null);

  const { data: mastData } = useApi(getMastHubbleJwst);
  const photos = ((mastData || []).filter((p) => p.collection === "HST")).slice(0, 12);

  useEffect(() => {
    if (modalIdx === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModalIdx(null);
      else if (e.key === "ArrowLeft") setModalIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      else if (e.key === "ArrowRight") setModalIdx((i) => (i === null ? null : (i + 1) % photos.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIdx, photos.length]);

  const modal = modalIdx !== null ? photos[modalIdx] : null;

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("hubble.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("hubble.hero.title") }} />
            <p className="hero-sub">{t("hubble.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#gallery" className="btn primary">{t("hubble.hero.galleryCta")}</a>
              <a href="#facts" className="btn ghost">{t("hubble.hero.factsCta")}</a>
            </div>
          </div>
          <Suspense fallback={<div className="tele3d-hero-placeholder"><span className="tele3d-spinner" /></div>}>
            <HubbleHeroPreview onOpenFullscreen={() => setShow3D(true)} />
          </Suspense>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.s1.eyebrow")} title={t("hubble.s1.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("hubble.card.launch")}</div>
              <div className="v">{t("hubble.card.launchValue")}</div>
              <div className="foot">{t("hubble.card.launchFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("hubble.card.orbit")}</div>
              <div className="v">535<span className="unit">{t("common.units.km")}</span></div>
              <div className="foot">{t("hubble.card.orbitFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("hubble.card.mirror")}</div>
              <div className="v">2.4<span className="unit">{t("hubble.card.mirrorUnit")}</span></div>
              <div className="foot">{t("hubble.card.mirrorFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("hubble.card.observations")}</div>
              <div className="v">1.6+<span className="unit">{t("hubble.card.observationsUnit")}</span></div>
              <div className="foot">{t("hubble.card.observationsFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="vs-jwst" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.vsJwst.eyebrow")} title={t("hubble.vsJwst.title")} />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("hubble.vsJwst.param")}</th>
                  <th>{t("hubble.vsJwst.hubbleCol")}</th>
                  <th>{t("hubble.vsJwst.jwstCol")}</th>
                </tr>
              </thead>
              <tbody>
                {VS_ROWS.map((r) => (
                  <tr key={r}>
                    <td>{t(`hubble.vsJwst.${r}_label`)}</td>
                    <td className="mono">{t(`hubble.vsJwst.${r}_hubble`)}</td>
                    <td className="mono">{t(`hubble.vsJwst.${r}_jwst`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="section-sub" style={{ marginTop: 14, marginBottom: 0 }}>
            {t("hubble.vsJwst.note")} <LocalizedLink to="jwst" className="section-link">{t("hubble.vsJwst.jwstLink")} →</LocalizedLink>
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.iconic.eyebrow")} title={t("hubble.iconic.title")} />
          <div className="grid cols-3">
            {ICONIC.map((g) => (
              <div className="iconic-img-card" key={g.key}>
                <div className="photo" style={{ backgroundImage: `url(${g.image})` }}>
                  <span className="tag">{g.tag}</span>
                </div>
                <div className="body">
                  <h4>{t(`hubble.iconic.${g.key}_title`)}</h4>
                  <p>{t(`hubble.iconic.${g.key}_body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="gallery" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.gallery.eyebrow")} title={t("hubble.gallery.title")} />
          <p className="section-sub">{t("hubble.gallery.sub")}</p>
          {!mastData && <p className="section-sub">{t("hubble.gallery.loading")}</p>}
          {mastData && photos.length === 0 && <p className="section-sub">{t("hubble.gallery.empty")}</p>}
          {photos.length > 0 && (
            <div className="grid cols-3">
              {photos.map((p, i) => (
                <div key={i} className="card" onClick={() => setModalIdx(i)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModalIdx(i); } }}
                  style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "zoom-in" }}>
                  <img src={p.jpeg_url} alt={p.target} style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} loading="lazy" />
                  <div style={{ padding: 16, fontSize: "0.9rem", color: "var(--text-dim)" }}>
                    <strong style={{ color: "var(--text)" }}>{p.target}</strong><br />{p.instrument}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 6 }}>{p.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" id="servicing" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.servicing.eyebrow")} title={t("hubble.servicing.title")} />
          {SERVICING.map((s) => (
            <FeatureRow key={s} tag={t(`hubble.servicing.${s}_tag`)} title={t(`hubble.servicing.${s}_title`)} num={t(`hubble.servicing.${s}_num`)}>
              {t(`hubble.servicing.${s}_body`)}
            </FeatureRow>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.instruments.eyebrow")} title={t("hubble.instruments.title")} />
          <p className="section-sub">{t("hubble.instruments.sub")}</p>
          <div className="grid cols-3">
            {INSTRUMENTS.map((k) => (
              <div className="card" key={k}>
                <div className="k">{t(`hubble.instruments.${k}_title`)}</div>
                <div className="v" style={INSTR_BODY_STYLE}>{t(`hubble.instruments.${k}_body`)}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: "8px 22px", marginTop: 16 }}>
            {INSTR_STATUS.map((it) => (
              <div className="mission-row" key={it.key}>
                <span
                  className={it.active ? "dot live" : undefined}
                  style={it.active ? undefined : { width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }}
                />
                <span className="nm">{t(`hubble.instrStatus.${it.key}`)}</span>
                <span className="ag">{t("hubble.instrStatus.installed", { year: it.year })}</span>
                <span className="yr" />
                <span className={"st" + (it.active ? " active" : " retired")}>
                  {it.active ? t("hubble.instrStatus.active") : t("hubble.instrStatus.retired")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.science.eyebrow")} title={t("hubble.science.title")} />
          <div className="grid cols-3">
            {SCIENCE.map((s) => (
              <div className="card" key={s}>
                <div className="k">{t(`hubble.science.${s}_title`)}</div>
                <div className="v" style={SCI_VALUE_STYLE}>{t(`hubble.science.${s}_value`)}</div>
                <div className="foot">{t(`hubble.science.${s}_body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="future" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.future.eyebrow")} title={t("hubble.future.title")} />
          <div className="grid cols-2">
            <div className="card" style={{ padding: 22 }}>
              <div className="k">{t("hubble.future.decayTitle")}</div>
              <div style={{ marginTop: 10, fontSize: "13.5px", color: "var(--text-dim)", lineHeight: 1.7 }}>{t("hubble.future.decayBody")}</div>
            </div>
            <div className="card" style={{ padding: 22 }}>
              <div className="k">{t("hubble.future.proposalTitle")}</div>
              <div style={{ marginTop: 10, fontSize: "13.5px", color: "var(--text-dim)", lineHeight: 1.7 }}>{t("hubble.future.proposalBody")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="facts" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("hubble.facts.eyebrow")} title={t("hubble.facts.title")} />
          <p className="section-sub">{t("hubble.facts.sub")}</p>
          <div className="grid cols-3">
            {FACTS.map((f) => (
              <div className="card" key={f}>
                <div className="v" style={FACT_TITLE_STYLE}>{t(`hubble.facts.${f}_title`)}</div>
                <div style={FACT_BODY_STYLE}>{t(`hubble.facts.${f}_body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {show3D && (
        <Suspense fallback={null}>
          <HubbleFullscreen onClose={() => setShow3D(false)} />
        </Suspense>
      )}

      {modal && (
        <div className="photo-modal open" onClick={() => setModalIdx(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-img" style={{ backgroundImage: `url("${modal.jpeg_url}")` }}>
              <button className="photo-modal-close" onClick={() => setModalIdx(null)} aria-label={t("hubble.gallery.close")}>✕</button>
              {photos.length > 1 && (
                <>
                  <button className="photo-modal-nav prev" aria-label={t("hubble.gallery.prev")}
                    onClick={() => setModalIdx((i) => (i - 1 + photos.length) % photos.length)}>‹</button>
                  <button className="photo-modal-nav next" aria-label={t("hubble.gallery.next")}
                    onClick={() => setModalIdx((i) => (i + 1) % photos.length)}>›</button>
                </>
              )}
            </div>
            <div className="photo-modal-info">
              <h3>{modal.target}</h3>
              <p>{modal.instrument} · {modal.date}</p>
              <p>{modal.coords}</p>
              <a className="section-link" style={{ marginTop: "auto", paddingTop: 18 }}
                href={modal.jpeg_url} target="_blank" rel="noopener noreferrer">
                {t("hubble.gallery.openFull")} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
