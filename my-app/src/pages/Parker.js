import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSeo } from "../hooks/useSeo";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import MissionTimeline from "../components/parker/MissionTimeline";
import "../styles/telescope3d.css";


const ParkerHeroPreview = lazy(() => import("./ParkerHeroPreview"));
const ParkerFullscreen = lazy(() => import("./ParkerFullscreen"));
// three.js/@react-three/fiber/drei are heavy — lazy-load so the base page
// bundle stays light (same reasoning as the hero/fullscreen 3D viewers).
const ParkerOrbitDiagram = lazy(() => import("../components/parker/ParkerOrbitDiagram"));

const INSTRUMENTS = ["fields", "wispr", "sweap", "isis"];
const INSTR_BODY_STYLE = { fontSize: "0.95rem", color: "var(--text-dim)", marginTop: 8, lineHeight: 1.5 };
const TIMELINE = ["t1", "t2", "t3", "t4", "t5", "t6"];
// Real NASA Image Library photos (images-api.nasa.gov), mirrored locally —
// same treatment as Roman.js's/Hubble.js's ICONIC array. Parker has no public
// WISPR science-imagery feed, so this is the real build/launch sequence
// instead (chronological, Apr–Aug 2018).
const GALLERY = [
  { key: "g1", image: "/parker/images/antenna_deployment.jpg" },
  { key: "g2", image: "/parker/images/heat_shield.jpg" },
  { key: "g3", image: "/parker/images/encapsulation.jpg" },
  { key: "g4", image: "/parker/images/lift_and_mate.jpg" },
  { key: "g5", image: "/parker/images/rollback.jpg" },
  { key: "g6", image: "/parker/images/launch.jpg" },
];

export default function Parker() {
  const { t } = useTranslation();
  const [show3D, setShow3D] = useState(false);
  useSeo("parker");

  useEffect(() => {
    document.title = t("title.parker");
  }, [t]);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("parker.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("parker.hero.title") }} />
            <p className="hero-sub">{t("parker.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#facts" className="btn primary">{t("parker.hero.factsCta")}</a>
              <a href="#instruments" className="btn ghost">{t("parker.hero.instrumentsCta")}</a>
            </div>
          </div>
          <Suspense fallback={<div className="tele3d-hero-placeholder"><span className="tele3d-spinner" /></div>}>
            <ParkerHeroPreview onOpenFullscreen={() => setShow3D(true)} />
          </Suspense>
        </div>
      </section>

      {show3D && (
        <Suspense fallback={null}>
          <ParkerFullscreen onClose={() => setShow3D(false)} />
        </Suspense>
      )}

      <section className="section" id="facts" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <SectionHead title={t("parker.facts.title")} />
          <div className="grid cols-3" style={{ marginTop: 32 }}>
            <div className="card">
              <div className="k">{t("parker.facts.speed_title")}</div>
              <div className="v" style={{ fontSize: "1.8rem", color: "var(--coral)", fontWeight: 700, margin: "12px 0" }}>{t("parker.facts.speed_val")}</div>
              <div style={INSTR_BODY_STYLE}>{t("parker.facts.speed_desc")}</div>
            </div>
            <div className="card">
              <div className="k">{t("parker.facts.dist_title")}</div>
              <div className="v" style={{ fontSize: "1.8rem", color: "var(--teal)", fontWeight: 700, margin: "12px 0" }}>{t("parker.facts.dist_val")}</div>
              <div style={INSTR_BODY_STYLE}>{t("parker.facts.dist_desc")}</div>
            </div>
            <div className="card">
              <div className="k">{t("parker.facts.venus_title")}</div>
              <div className="v" style={{ fontSize: "1.8rem", color: "var(--gold)", fontWeight: 700, margin: "12px 0" }}>{t("parker.facts.venus_val")}</div>
              <div style={INSTR_BODY_STYLE}>{t("parker.facts.venus_desc")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead title={t("parker.orbit.title")} />
          <p className="section-sub">{t("parker.orbit.sub")}</p>
          <Suspense fallback={<div style={{ height: 420, margin: "32px 0", background: "#06070a", borderRadius: 16 }} />}>
            <ParkerOrbitDiagram />
          </Suspense>
        </div>
      </section>


      <section className="section" id="timeline" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("parker.timeline.eyebrow")} title={t("parker.timeline.title")} />
          <MissionTimeline events={TIMELINE} />
        </div>
      </section>

      <section className="section" id="instruments" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("parker.instruments.eyebrow")} title={t("parker.instruments.title")} />
          <div className="grid cols-4" style={{ marginTop: 24 }}>
            {INSTRUMENTS.map((k) => (
              <div className="card" key={k}>
                <div className="k" style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--gold)" }}>{t(`parker.instruments.${k}_title`)}</div>
                <div className="v" style={INSTR_BODY_STYLE}>{t(`parker.instruments.${k}_desc`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="gallery" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("parker.gallery.eyebrow")} title={t("parker.gallery.title")} />
          <p className="section-sub">{t("parker.gallery.sub")}</p>
          <div className="grid cols-3">
            {GALLERY.map((g) => (
              <div className="iconic-img-card" key={g.key}>
                <div className="photo" style={{ backgroundImage: `url(${g.image})` }}>
                  <span className="tag">{t(`parker.gallery.${g.key}_tag`)}</span>
                </div>
                <div className="body">
                  <h4>{t(`parker.gallery.${g.key}_title`)}</h4>
                  <p>{t(`parker.gallery.${g.key}_body`)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="section-sub" style={{ marginTop: 14, marginBottom: 0 }}>{t("parker.gallery.credit")}</p>
        </div>
      </section>
    </>
  );
}
