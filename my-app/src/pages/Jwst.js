// James Webb Space Telescope page — same structure as Hubble.js (hero with
// live 3D preview, mission stats, MAST image gallery filtered to JWST,
// instrument cards, fun facts). See Hubble.js's header comment for the
// shared patterns this mirrors.
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../styles/gallery.css"; // For .photo-modal
import "../styles/telescope3d.css"; // For .tele3d-hero-* (hero 3D preview + loading placeholder)
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import { useApi } from "../hooks/useApi";
import { getMastHubbleJwst } from "../lib/api";

const JwstHeroPreview = lazy(() => import("./JwstHeroPreview"));
const JwstFullscreen = lazy(() => import("./JwstFullscreen"));

const INSTR_BODY_STYLE = { fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", marginTop: 8, fontWeight: 400 };
const FACT_TITLE_STYLE = { fontSize: "1.2rem", marginBottom: 8, color: "var(--accent)" };
const FACT_BODY_STYLE = { fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", fontWeight: 400, textTransform: "none" };
const SCI_VALUE_STYLE = { fontSize: 20 };
const INSTRUMENTS = ["i1", "i2", "i3", "i4"];
const FACTS = ["f1", "f2", "f3", "f4", "f5", "f6"];
const DEPLOYMENT = ["d1", "d2", "d3", "d4"];
const SCIENCE = ["sci1", "sci2", "sci3"];
// All four instruments are active — unlike Hubble's mix of active/retired,
// JWST's design distinguishes them by role/agency, not operational status.
const INSTR_STATUS = [
  { key: "nircam", agency: "США" },
  { key: "nirspec", agency: "ESA" },
  { key: "miri", agency: "ESA / NASA" },
  { key: "fgsniriss", agency: "CSA" },
];
// Curated first-light milestones (July 2022) — separate from the live
// "recent observations" gallery below. Gradient tiles, same treatment as
// Hubble.js originally used before real photos were dropped in; swap in
// /jwst/images/*.jpg the same way once available.
const ICONIC = [
  { key: "ic1", tag: "2022", image: "/jwst/images/carina.jpg" },
  { key: "ic2", tag: "2022", image: "/jwst/images/smacs.jpg" },
  { key: "ic3", tag: "2022", image: "/jwst/images/southern_ring.jpg" },
  { key: "ic4", tag: "2022", image: "/jwst/images/pillars.jpg" },
  { key: "ic5", tag: "2022", image: "/jwst/images/stephans.jpg" },
  { key: "ic6", tag: "2022", image: "/jwst/images/wasp96b.jpg" },
];

export default function Jwst() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.jwst"); }, [t]);
  const [show3D, setShow3D] = useState(false);
  const [modalIdx, setModalIdx] = useState(null);

  const { data: mastData } = useApi(getMastHubbleJwst);
  const photos = ((mastData || []).filter((p) => p.collection === "JWST")).slice(0, 12);

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
            <div className="eyebrow"><span className="dot live" /> {t("jwst.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("jwst.hero.title") }} />
            <p className="hero-sub">{t("jwst.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#gallery" className="btn primary">{t("jwst.hero.galleryCta")}</a>
              <a href="#facts" className="btn ghost">{t("jwst.hero.factsCta")}</a>
            </div>
          </div>
          <Suspense fallback={<div className="tele3d-hero-placeholder"><span className="tele3d-spinner" /></div>}>
            <JwstHeroPreview onOpenFullscreen={() => setShow3D(true)} />
          </Suspense>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.s1.eyebrow")} title={t("jwst.s1.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("jwst.card.launch")}</div>
              <div className="v">{t("jwst.card.launchValue")}</div>
              <div className="foot">{t("jwst.card.launchFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jwst.card.distance")}</div>
              <div className="v">1.5<span className="unit">{t("jwst.card.distanceUnit")}</span></div>
              <div className="foot">{t("jwst.card.distanceFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jwst.card.mirror")}</div>
              <div className="v">6.5<span className="unit">{t("jwst.card.mirrorUnit")}</span></div>
              <div className="foot">{t("jwst.card.mirrorFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jwst.card.segments")}</div>
              <div className="v">18<span className="unit">{t("jwst.card.segmentsUnit")}</span></div>
              <div className="foot">{t("jwst.card.segmentsFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jwst.card.sunshield")}</div>
              <div className="v">21×14<span className="unit">{t("jwst.card.sunshieldUnit")}</span></div>
              <div className="foot">{t("jwst.card.sunshieldFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jwst.card.lifespan")}</div>
              <div className="v">~20<span className="unit">{t("jwst.card.lifespanUnit")}</span></div>
              <div className="foot">{t("jwst.card.lifespanFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="l2" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.l2.eyebrow")} title={t("jwst.l2.title")} />
          <p className="section-sub">{t("jwst.l2.intro")}</p>
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("jwst.l2.stability_title")}</div>
              <div className="v" style={SCI_VALUE_STYLE}>{t("jwst.l2.stability_value")}</div>
              <div className="foot">{t("jwst.l2.stability_body")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jwst.l2.servicing_title")}</div>
              <div className="v" style={SCI_VALUE_STYLE}>{t("jwst.l2.servicing_value")}</div>
              <div className="foot">{t("jwst.l2.servicing_body")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jwst.l2.period_title")}</div>
              <div className="v" style={SCI_VALUE_STYLE}>{t("jwst.l2.period_value")}</div>
              <div className="foot">{t("jwst.l2.period_body")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="deployment" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.deployment.eyebrow")} title={t("jwst.deployment.title")} />
          {DEPLOYMENT.map((d) => (
            <FeatureRow key={d} tag={t(`jwst.deployment.${d}_tag`)} title={t(`jwst.deployment.${d}_title`)} num={t(`jwst.deployment.${d}_num`)}>
              {t(`jwst.deployment.${d}_body`)}
            </FeatureRow>
          ))}
          <p className="section-sub" style={{ marginTop: 14, marginBottom: 0, fontSize: 11 }}>{t("jwst.deployment.note")}</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.iconic.eyebrow")} title={t("jwst.iconic.title")} />
          <div className="grid cols-3">
            {ICONIC.map((g) => (
              <div className="iconic-img-card" key={g.key}>
                <div className="photo" style={{ backgroundImage: `url(${g.image})` }}>
                  <span className="tag">{g.tag}</span>
                </div>
                <div className="body">
                  <h4>{t(`jwst.iconic.${g.key}_title`)}</h4>
                  <p>{t(`jwst.iconic.${g.key}_body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="gallery" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.gallery.eyebrow")} title={t("jwst.gallery.title")} />
          <p className="section-sub">{t("jwst.gallery.sub")}</p>
          {!mastData && <p className="section-sub">{t("jwst.gallery.loading")}</p>}
          {mastData && photos.length === 0 && <p className="section-sub">{t("jwst.gallery.empty")}</p>}
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

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.science.eyebrow")} title={t("jwst.science.title")} />
          <div className="grid cols-3">
            {SCIENCE.map((s) => (
              <div className="card" key={s}>
                <div className="k">{t(`jwst.science.${s}_title`)}</div>
                <div className="v" style={SCI_VALUE_STYLE}>{t(`jwst.science.${s}_value`)}</div>
                <div className="foot">{t(`jwst.science.${s}_body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.instruments.eyebrow")} title={t("jwst.instruments.title")} />
          <p className="section-sub">{t("jwst.instruments.sub")}</p>
          <div className="grid cols-4">
            {INSTRUMENTS.map((k) => (
              <div className="card" key={k}>
                <div className="k">{t(`jwst.instruments.${k}_title`)}</div>
                <div className="v" style={INSTR_BODY_STYLE}>{t(`jwst.instruments.${k}_body`)}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: "8px 22px", marginTop: 16 }}>
            {INSTR_STATUS.map((it) => (
              <div className="mission-row" key={it.key}>
                <span className="dot live" />
                <span className="nm">{t(`jwst.instrStatus.${it.key}`)}</span>
                <span className="ag">{it.agency}</span>
                <span className="yr" />
                <span className="st active">{t(`jwst.instrStatus.${it.key}_status`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="vs-hubble" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.vsHubble.eyebrow")} title={t("jwst.vsHubble.title")} />
          <FeatureRow to="hubble" tag={t("jwst.vsHubble.tag")} title={t("jwst.vsHubble.rowTitle")} num={t("jwst.vsHubble.num")}>
            {t("jwst.vsHubble.body")}
          </FeatureRow>
        </div>
      </section>

      <section className="section" id="facts" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("jwst.facts.eyebrow")} title={t("jwst.facts.title")} />
          <p className="section-sub">{t("jwst.facts.sub")}</p>
          <div className="grid cols-3">
            {FACTS.map((f) => (
              <div className="card" key={f}>
                <div className="v" style={FACT_TITLE_STYLE}>{t(`jwst.facts.${f}_title`)}</div>
                <div style={FACT_BODY_STYLE}>{t(`jwst.facts.${f}_body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {show3D && (
        <Suspense fallback={null}>
          <JwstFullscreen onClose={() => setShow3D(false)} />
        </Suspense>
      )}

      {modal && (
        <div className="photo-modal open" onClick={() => setModalIdx(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-img" style={{ backgroundImage: `url("${modal.jpeg_url}")` }}>
              <button className="photo-modal-close" onClick={() => setModalIdx(null)} aria-label={t("jwst.gallery.close")}>✕</button>
              {photos.length > 1 && (
                <>
                  <button className="photo-modal-nav prev" aria-label={t("jwst.gallery.prev")}
                    onClick={() => setModalIdx((i) => (i - 1 + photos.length) % photos.length)}>‹</button>
                  <button className="photo-modal-nav next" aria-label={t("jwst.gallery.next")}
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
                {t("jwst.gallery.openFull")} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
